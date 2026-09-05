const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const socketManager = require('../socketManager');
const router = express.Router();

router.use(authenticate);

// ─── Helper: resolve customer user_id for an order ───────────────────────────
async function getOrderParticipants(orderId) {
  const result = await db.query(
    `SELECT o.id as order_id, o.status,
       cu.id as customer_user_id,
       du.id as driver_user_id
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     JOIN users cu ON c.user_id = cu.id
     LEFT JOIN drivers dr ON o.driver_id = dr.id
     LEFT JOIN users du ON dr.user_id = du.id
     WHERE o.id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

// Get driver dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const driverResult = await db.query(
      `SELECT d.*, v.type as vehicle_type, v.name_ar, v.name_en, v.icon, u.name, u.phone, u.avatar_url
       FROM drivers d
       JOIN vehicles v ON d.vehicle_id = v.id
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = $1`,
      [req.user.id]
    );

    if (driverResult.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });

    const driver = driverResult.rows[0];

    // Today's stats
    // Use CURRENT_DATE (pure SQL) — avoids JS timezone offset mismatches
    const todayOrders = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(driver_earnings), 0) as earnings
       FROM orders WHERE driver_id = $1 AND completed_at >= CURRENT_DATE`,
      [driver.id]
    );

    const activeOrder = await db.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o
       JOIN customers cust ON o.customer_id = cust.id
       JOIN users c ON cust.user_id = c.id
       WHERE o.driver_id = $1 AND o.status NOT IN ('completed', 'cancelled')
       ORDER BY o.created_at DESC LIMIT 1`,
      [driver.id]
    );

    const shifts = await db.query(
      'SELECT * FROM driver_shifts WHERE driver_id = $1 AND is_active = true ORDER BY day_of_week',
      [driver.id]
    );

    res.json({
      driver: {
        ...driver,
        prepaid_balance:        driver.prepaid_balance != null ? parseFloat(driver.prepaid_balance) : 0,
        balance_renewal_amount: driver.balance_renewal_amount != null ? parseFloat(driver.balance_renewal_amount) : 1000,
        total_earnings:         driver.total_earnings != null ? parseFloat(driver.total_earnings) : 0,
        unpaid_earnings:        driver.unpaid_earnings != null ? parseFloat(driver.unpaid_earnings) : 0,
      },
      today: todayOrders.rows[0],
      activeOrder: activeOrder.rows[0] || null,
      shifts: shifts.rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update availability
router.put('/availability', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE drivers SET availability_status = $1 WHERE user_id = $2',
      [status, req.user.id]
    );
    res.json({ message: 'Availability updated', status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update location — also pushes driver location to customer via socket
router.put('/location', async (req, res) => {
  try {
    const { location_id, latitude, longitude } = req.body;
    await db.query(
      'UPDATE drivers SET current_location_id = $1, latitude = $2, longitude = $3 WHERE user_id = $4',
      [location_id, latitude, longitude, req.user.id]
    );

    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverResult.rows.length > 0 && latitude && longitude) {
      const driverId = driverResult.rows[0].id;

      await db.query(
        'INSERT INTO driver_location_history (driver_id, latitude, longitude) VALUES ($1, $2, $3)',
        [driverId, latitude, longitude]
      );

      // Find the customer of the active order and push location update
      const activeOrderResult = await db.query(
        `SELECT o.id, cu.id as customer_user_id
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         JOIN users cu ON c.user_id = cu.id
         WHERE o.driver_id = $1 AND o.status NOT IN ('completed', 'cancelled')
         LIMIT 1`,
        [driverId]
      );

      if (activeOrderResult.rows.length > 0) {
        const { id: orderId, customer_user_id } = activeOrderResult.rows[0];
        socketManager.emitDriverLocation(customer_user_id, { orderId, latitude, longitude });
      }
    }

    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available orders
router.get('/available-orders', async (req, res) => {
  try {
    const driverResult = await db.query('SELECT * FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverResult.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });

    const driver = driverResult.rows[0];

    const orders = await db.query(
      `SELECT o.*, v.type as vehicle_type, c.name as customer_name, c.phone as customer_phone,
        (SELECT COUNT(*) FROM order_locations WHERE order_id = o.id) as location_count
       FROM orders o
       JOIN vehicles v ON o.vehicle_id = v.id
       JOIN customers cust ON o.customer_id = cust.id
       JOIN users c ON cust.user_id = c.id
       WHERE o.status = 'finding_driver'
       AND o.vehicle_id = $1
       AND o.driver_id IS NULL
       ORDER BY o.created_at DESC`,
      [driver.vehicle_id]
    );

    // Block if driver is not active/approved
    if (!driver.is_active || !driver.is_approved) {
      return res.json([]);
    }

    // Block if prepaid balance is depleted
    if (parseFloat(driver.prepaid_balance) <= 0) {
      return res.status(402).json({
        message: 'رصيدك المدفوع مسبقاً نفد — تواصل مع المشرف لتجديد الرصيد',
        balance_depleted: true,
        prepaid_balance: 0
      });
    }

    res.json(orders.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accept order — emit order_update to customer
router.post('/accept-order/:orderId', async (req, res) => {
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const driverResult = await client.query('SELECT id FROM drivers WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    if (driverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return res.status(404).json({ message: 'Driver not found' });
    }

    const driverId = driverResult.rows[0].id;
    const orderId = req.params.orderId;

    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND status = $2 AND driver_id IS NULL FOR UPDATE',
      [orderId, 'finding_driver']
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return res.status(400).json({ message: 'Order no longer available' });
    }

    await client.query(
      `UPDATE orders SET driver_id = $1, status = 'driver_accepted', accepted_at = NOW() WHERE id = $2`,
      [driverId, orderId]
    );

    await client.query(
      "UPDATE drivers SET availability_status = 'busy' WHERE id = $1",
      [driverId]
    );

    await client.query('COMMIT');
    client.release();
    client = null;

    // Emit real-time update to customer
    const participants = await getOrderParticipants(orderId);
    if (participants) {
      socketManager.emitOrderUpdate(participants.customer_user_id, null, {
        orderId,
        status: 'driver_accepted'
      });
    }

    res.json({ message: 'Order accepted' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    res.status(500).json({ message: error.message });
  }
});

// Update order status — validates transition and guards against double-completion
router.put('/order-status/:orderId', async (req, res) => {
  const TRANSITIONS = {
    driver_accepted: 'going_to_location',
    going_to_location: 'arrived_at_location',
    arrived_at_location: 'items_collected',
    items_collected: 'delivering',
    delivering: 'completed'
  };
  let client;
  try {
    const { status } = req.body;
    if (!Object.values(TRANSITIONS).includes(status)) {
      return res.status(400).json({ message: `Invalid status: ${status}` });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');
    const driverResult = await client.query('SELECT id FROM drivers WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    if (driverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return res.status(404).json({ message: 'Driver not found' });
    }
    const driverId = driverResult.rows[0].id;

    const orderCheck = await client.query(
      `SELECT id, status, completed_at FROM orders
       WHERE id = $1 AND driver_id = $2 AND status NOT IN ('completed','cancelled')
       FOR UPDATE`,
      [req.params.orderId, driverId]
    );
    if (orderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return res.status(400).json({ message: 'Order not found or already closed' });
    }
    if (TRANSITIONS[orderCheck.rows[0].status] !== status) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return res.status(400).json({ message: `Invalid transition from ${orderCheck.rows[0].status} to ${status}` });
    }

    await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND driver_id = $3',
      [status, req.params.orderId, driverId]
    );

    if (status === 'completed') {
      const completion = await client.query(
        `UPDATE orders SET completed_at = NOW()
         WHERE id = $1 AND completed_at IS NULL
         RETURNING driver_earnings, owner_earnings`,
        [req.params.orderId]
      );

      if (completion.rows.length > 0) {
        // The driver earns the driver share; prepaid balance pays only the admin share.
        const earnings = parseFloat(completion.rows[0].driver_earnings) || 0;
        const adminDeduction = Math.max(0, parseFloat(completion.rows[0].owner_earnings) || 0);

        // Atomically deduct — balance CAN go negative when the admin share exceeds it.
        const balResult = await client.query(
          `UPDATE drivers
             SET total_earnings  = total_earnings + $1,
                 prepaid_balance = prepaid_balance - $2
                 WHERE id = $3
           RETURNING prepaid_balance`,
          [earnings, adminDeduction, driverId]
        );
        const newBalance = balResult.rows[0]?.prepaid_balance != null
          ? parseFloat(balResult.rows[0].prepaid_balance)
          : 0;

        // Insert transaction record
        await client.query(
          `INSERT INTO driver_balance_transactions
             (driver_id, type, amount, balance_after, description, order_id)
           VALUES ($1, 'deduction', $2, $3, $4, $5)`,
            [driverId, adminDeduction, newBalance, 'خصم حصة المشرف من ربح التوصيل بعد الخصم', req.params.orderId]
        );

        // Legacy earnings row (kept for historical reference)
        await client.query(
          'INSERT INTO earnings (driver_id, order_id, amount) VALUES ($1, $2, $3)',
          [driverId, req.params.orderId, earnings]
        );

        // If balance is now depleted, set driver offline
        if (newBalance <= 0) {
          await client.query(
            "UPDATE drivers SET availability_status = 'offline' WHERE id = $1",
            [driverId]
          );
        } else {
          await client.query(
            "UPDATE drivers SET availability_status = 'available' WHERE id = $1",
            [driverId]
          );
        }
      } else {
        // Already completed (retry) — just ensure driver is back to correct state
        await client.query(
          "UPDATE drivers SET availability_status = CASE WHEN prepaid_balance > 0 THEN 'available' ELSE 'offline' END WHERE id = $1",
          [driverId]
        );
      }

    }

    await client.query('COMMIT');
    client.release();
    client = null;

    // Emit real-time update to customer (and driver's own room for consistency)
    const participants = await getOrderParticipants(req.params.orderId);
    if (participants) {
      socketManager.emitOrderUpdate(
        participants.customer_user_id,
        participants.driver_user_id,
        { orderId: req.params.orderId, status }
      );
    }

    res.json({ message: 'Status updated' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    res.status(500).json({ message: error.message });
  }
});

// Add order item (driver purchase)
router.post('/order-items/:orderId', async (req, res) => {
  try {
    const { order_location_id, name, quantity, unit, price } = req.body;
    const total = parseFloat(price) * (parseInt(quantity) || 1);

    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    const driverId = driverResult.rows[0].id;

    const orderCheck = await db.query(
      'SELECT id FROM orders WHERE id = $1 AND driver_id = $2',
      [req.params.orderId, driverId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const result = await db.query(
      `INSERT INTO order_items (order_id, order_location_id, name, quantity, unit, price, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.orderId, order_location_id, name, quantity, unit, price, total]
    );

    // Update order items subtotal
    await db.query(
      `UPDATE orders SET items_subtotal = (SELECT COALESCE(SUM(total), 0) FROM order_items WHERE order_id = $1)
       WHERE id = $1`,
      [req.params.orderId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get earnings history
router.get('/earnings', async (req, res) => {
  try {
    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    const driverId = driverResult.rows[0].id;

    const earnings = await db.query(
      `SELECT e.*, o.order_number, o.created_at as order_date
       FROM earnings e
       JOIN orders o ON e.order_id = o.id
       WHERE e.driver_id = $1
       ORDER BY e.created_at DESC`,
      [driverId]
    );

    const payouts = await db.query(
      `SELECT * FROM driver_payouts WHERE driver_id = $1 ORDER BY created_at DESC`,
      [driverId]
    );

    res.json({ earnings: earnings.rows, payouts: payouts.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get the driver's prepaid balance history (deposits, deductions, and admin adjustments)
router.get('/balance-history', async (req, res) => {
  try {
    const driverResult = await db.query(
      `SELECT d.prepaid_balance, d.total_earnings
       FROM drivers d WHERE d.user_id = $1`,
      [req.user.id]
    );
    if (!driverResult.rows.length) return res.status(404).json({ message: 'Driver not found' });

    const transactions = await db.query(
      `SELECT t.*, o.order_number, u.name AS created_by_name
       FROM driver_balance_transactions t
       LEFT JOIN orders o ON t.order_id = o.id
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.driver_id = (SELECT id FROM drivers WHERE user_id = $1)
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [req.user.id]
    );

    res.json({
      prepaid_balance: parseFloat(driverResult.rows[0].prepaid_balance) || 0,
      total_earnings: parseFloat(driverResult.rows[0].total_earnings) || 0,
      transactions: transactions.rows.map(transaction => ({
        ...transaction,
        amount: parseFloat(transaction.amount) || 0,
        balance_after: parseFloat(transaction.balance_after) || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get driver's own order history (completed + cancelled)
router.get('/history', async (req, res) => {
  try {
    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverResult.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });
    const driverId = driverResult.rows[0].id;

    const orders = await db.query(
      `SELECT o.id, o.order_number, o.status, o.service_type,
         o.delivery_fee, o.service_fee, o.places_fee, o.items_subtotal,
         o.promo_discount, o.final_total,
         COALESCE(o.driver_earnings, 0) AS driver_earnings,
         o.customer_address, o.customer_phone, o.num_places,
         o.notes, o.created_at, o.completed_at,
         cu.name as customer_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users cu ON c.user_id = cu.id
       WHERE o.driver_id = $1
         AND o.status IN ('completed', 'cancelled')
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [driverId]
    );

    if (orders.rows.length === 0) return res.json([]);

    // ── Fetch ALL locations in one query (replaces N+1 loop) ──────────────────
    const orderIds = orders.rows.map(o => o.id);
    const locsResult = await db.query(
      `SELECT ol.order_id, ol.custom_address, ol.location_name,
              ol.sort_order, l.name_ar, l.delivery_price
       FROM order_locations ol
       LEFT JOIN locations l ON ol.location_id = l.id
       WHERE ol.order_id = ANY($1::uuid[])
       ORDER BY ol.order_id, ol.sort_order`,
      [orderIds]
    );

    // Group locations by order_id for fast lookup
    const locsByOrder = {};
    for (const loc of locsResult.rows) {
      if (!locsByOrder[loc.order_id]) locsByOrder[loc.order_id] = [];
      locsByOrder[loc.order_id].push(loc);
    }

    const result = orders.rows.map(order => ({
      ...order,
      locations: locsByOrder[order.id] || []
    }));

    res.json(result);
  } catch (error) {
    console.error('[GET /drivers/history]', error.message);
    res.status(500).json({ message: 'فشل تحميل سجل الطلبات: ' + error.message });
  }
});

// Get single order details (for driver) — includes place_details + estimate fields
router.get('/order/:id', async (req, res) => {
  try {
    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverResult.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });

    const orderResult = await db.query(
      `SELECT o.*,
        cu.id as customer_user_id,
        cu.name as customer_name, cu.phone as customer_phone,
        du.id as driver_user_id
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users cu ON c.user_id = cu.id
       LEFT JOIN drivers dr ON o.driver_id = dr.id
       LEFT JOIN users du ON dr.user_id = du.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    const locationsResult = await db.query(
      `SELECT ol.*, l.name_ar FROM order_locations ol
       LEFT JOIN locations l ON ol.location_id = l.id
       WHERE ol.order_id = $1 ORDER BY ol.sort_order`,
      [req.params.id]
    );

    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);

    const order = orderResult.rows[0];
    // Ensure place_details and estimate_items are parsed arrays
    if (typeof order.place_details === 'string') order.place_details = JSON.parse(order.place_details || '[]');
    if (typeof order.estimate_items === 'string') order.estimate_items = JSON.parse(order.estimate_items || '[]');

    res.json({ ...order, locations: locationsResult.rows, items: itemsResult.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Send cost estimate / receipt to customer ─────────────────────────────────
router.post('/send-estimate/:orderId', async (req, res) => {
  try {
    const { estimate_items, estimate_total } = req.body;
    if (!estimate_items || !Array.isArray(estimate_items) || estimate_items.length === 0) {
      return res.status(400).json({ message: 'estimate_items is required' });
    }

    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverResult.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });
    const driverId = driverResult.rows[0].id;

    // Verify this order belongs to this driver
    const orderCheck = await db.query(
      'SELECT id, customer_id FROM orders WHERE id = $1 AND driver_id = $2',
      [req.params.orderId, driverId]
    );
    if (orderCheck.rows.length === 0) return res.status(403).json({ message: 'Not authorized' });

    // Save estimate
    await db.query(
      `UPDATE orders SET estimate_status = 'pending', estimate_items = $1,
       estimate_total = $2, estimate_sent_at = NOW() WHERE id = $3`,
      [JSON.stringify(estimate_items), parseFloat(estimate_total) || 0, req.params.orderId]
    );

    // Notify customer via socket
    const participants = await getOrderParticipants(req.params.orderId);
    if (participants) {
      socketManager.emitEstimate(participants.customer_user_id, {
        orderId: req.params.orderId,
        estimate_items,
        estimate_total: parseFloat(estimate_total) || 0,
      });
    }

    res.json({ message: 'Estimate sent to customer' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Driver cancels the order ──────────────────────────────────────────────────
router.post('/cancel-order/:orderId', async (req, res) => {
  try {
    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverResult.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });
    const driverId = driverResult.rows[0].id;

    const orderCheck = await db.query(
      `SELECT id FROM orders WHERE id = $1 AND driver_id = $2
       AND status NOT IN ('completed', 'cancelled')`,
      [req.params.orderId, driverId]
    );
    if (orderCheck.rows.length === 0) return res.status(400).json({ message: 'Order cannot be cancelled' });

    await db.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = $1",
      [req.params.orderId]
    );
    await db.query(
      "UPDATE drivers SET availability_status = 'available' WHERE id = $1",
      [driverId]
    );

    const participants = await getOrderParticipants(req.params.orderId);
    if (participants) {
      socketManager.emitOrderUpdate(participants.customer_user_id, null, {
        orderId: req.params.orderId, status: 'cancelled'
      });
    }

    res.json({ message: 'Order cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;