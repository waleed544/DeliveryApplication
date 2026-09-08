const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { bannerUpload } = require('../middleware/upload');
const db = require('../config/db');

// Helper: delete avatar file from disk if it's a local upload
const deleteAvatarFile = (avatarUrl) => {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, '..', avatarUrl);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { console.warn('Could not delete avatar file:', e.message); }
  }
};
const router = express.Router();

router.use(authenticate, authorize('admin'));

router.put('/account', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !phone.trim()) return res.status(400).json({ message: 'رقم الهاتف مطلوب' });
    if (password !== undefined && password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const duplicate = await db.query('SELECT id FROM users WHERE phone = $1 AND id <> $2', [phone.trim(), req.user.id]);
    if (duplicate.rows.length) return res.status(400).json({ message: 'رقم الهاتف مستخدم بالفعل' });

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET phone = $1, password_hash = $2, updated_at = NOW() WHERE id = $3', [phone.trim(), passwordHash, req.user.id]);
    } else {
      await db.query('UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2', [phone.trim(), req.user.id]);
    }
    res.json({ message: 'تم تحديث بيانات دخول المشرف', phone: phone.trim() });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ message: 'رقم الهاتف مستخدم بالفعل' });
    res.status(500).json({ message: error.message });
  }
});

const deleteBannerFile = (imageUrl) => {
  if (!imageUrl || !imageUrl.startsWith('/uploads/banners/')) return;
  const filePath = path.join(__dirname, '..', imageUrl);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

router.get('/banners', async (_req, res) => {
  try {
    const result = await db.query('SELECT * FROM banners ORDER BY sort_order, created_at DESC');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/banners', bannerUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'اختر صورة للإعلان' });
    const { title, audience = 'both', sort_order = 0 } = req.body;
    if (!['customer', 'driver', 'both'].includes(audience)) {
      deleteBannerFile(`/uploads/banners/${req.file.filename}`);
      return res.status(400).json({ message: 'الجمهور غير صالح' });
    }
    const result = await db.query(
      `INSERT INTO banners (title, image_url, audience, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title || null, `/uploads/banners/${req.file.filename}`, audience, Number(sort_order) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (req.file) deleteBannerFile(`/uploads/banners/${req.file.filename}`);
    res.status(500).json({ message: error.message });
  }
});

router.put('/banners/:id', async (req, res) => {
  try {
    const { title, audience, sort_order, is_active } = req.body;
    const result = await db.query(
      `UPDATE banners SET title = COALESCE($1, title), audience = COALESCE($2, audience),
       sort_order = COALESCE($3, sort_order), is_active = COALESCE($4, is_active) WHERE id = $5 RETURNING *`,
      [title, audience, sort_order == null ? null : Number(sort_order), is_active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'الإعلان غير موجود' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/banners/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM banners WHERE id = $1 RETURNING image_url', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'الإعلان غير موجود' });
    deleteBannerFile(result.rows[0].image_url);
    res.json({ message: 'تم حذف الإعلان' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Use CURRENT_DATE (pure SQL) — avoids JS timezone offset mismatches
    // All SUM() calls FILTER to 'completed' only — cancelled orders never count toward revenue
    const todayOrders = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        -- Service revenue is both discounted shares; purchase items are pass-through.
        COALESCE(SUM(driver_earnings + owner_earnings) FILTER (WHERE status = 'completed'), 0) as revenue,
        -- Total money collected including customer purchases (for reference only)
        COALESCE(SUM(final_total)      FILTER (WHERE status = 'completed'), 0) as total_collected,
        COALESCE(SUM(items_subtotal)   FILTER (WHERE status = 'completed'), 0) as purchases_total,
        COALESCE(SUM(driver_earnings)  FILTER (WHERE status = 'completed'), 0) as driver_earnings,
        COALESCE(SUM(owner_earnings)   FILTER (WHERE status = 'completed'), 0) as owner_earnings
       FROM orders WHERE created_at >= CURRENT_DATE`
    );

    const drivers = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE availability_status = 'available') as available,
        COUNT(*) FILTER (WHERE availability_status = 'busy') as busy,
        COUNT(*) FILTER (WHERE is_approved = false) as pending
       FROM drivers`
    );

    const totalUnpaid = await db.query('SELECT COALESCE(SUM(unpaid_earnings), 0) as total FROM drivers');

    res.json({
      today: todayOrders.rows[0],
      drivers: drivers.rows[0],
      totalUnpaid: totalUnpaid.rows[0].total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all drivers (including their shifts)
router.get('/drivers', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.name, u.phone, u.email, u.avatar_url, u.is_active as user_active,
        v.type as vehicle_type, v.name_ar as vehicle_name_ar, v.name_en as vehicle_name_en,
        (SELECT COUNT(*) FROM orders WHERE driver_id = d.id AND status = 'completed') as completed_orders
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       JOIN vehicles v ON d.vehicle_id = v.id
       ORDER BY d.created_at DESC`
    );

    // Attach shifts and parse decimal fields for each driver
    const drivers = result.rows;
    for (const driver of drivers) {
      const shiftsResult = await db.query(
        'SELECT * FROM driver_shifts WHERE driver_id = $1 ORDER BY day_of_week',
        [driver.id]
      );
      driver.shifts                  = shiftsResult.rows;
      driver.prepaid_balance         = driver.prepaid_balance        != null ? parseFloat(driver.prepaid_balance)        : 0;
      driver.balance_renewal_amount  = driver.balance_renewal_amount != null ? parseFloat(driver.balance_renewal_amount) : 1000;
      driver.total_earnings          = driver.total_earnings         != null ? parseFloat(driver.total_earnings)         : 0;
      driver.unpaid_earnings         = driver.unpaid_earnings        != null ? parseFloat(driver.unpaid_earnings)        : 0;
    }

    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all customers with stats
router.get('/customers', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.name, u.phone, u.email, u.created_at, u.is_active,
        COUNT(o.id)                                            AS total_orders,
        COUNT(o.id) FILTER (WHERE o.status = 'completed')     AS completed_orders,
        COUNT(o.id) FILTER (WHERE o.status = 'cancelled')     AS cancelled_orders,
        COALESCE(SUM(o.final_total) FILTER (WHERE o.status = 'completed'), 0) AS total_spent,
        MAX(o.created_at)                                      AS last_order_at
      FROM users u
      JOIN customers c ON c.user_id = u.id
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.name, u.phone, u.email, u.created_at, u.is_active
      ORDER BY total_orders DESC, u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get system settings (accepting_orders, offline_message)
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query(
      "SELECT key, value FROM system_settings WHERE key IN ('accepting_orders','offline_message')"
    );
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json({
      accepting_orders: map['accepting_orders'] !== 'false',
      offline_message: map['offline_message'] || 'المنصة غير متاحة حالياً، يرجى المحاولة لاحقاً.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update system settings
router.put('/settings', async (req, res) => {
  try {
    const { accepting_orders, offline_message } = req.body;
    await db.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES ('accepting_orders', $1, 'Global switch to accept new orders')
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [accepting_orders ? 'true' : 'false']);
    if (offline_message !== undefined) {
      await db.query(`
        INSERT INTO system_settings (key, value, description)
        VALUES ('offline_message', $1, 'Message shown when orders are disabled')
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      `, [offline_message]);
    }
    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve driver
router.put('/drivers/:id/approve', async (req, res) => {
  try {
    await db.query('UPDATE drivers SET is_approved = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Driver approved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle driver active — updates BOTH users.is_active (login) and drivers.is_active (display)
router.put('/drivers/:id/toggle', async (req, res) => {
  try {
    // Get current state from drivers table and the linked user_id
    const result = await db.query(
      'SELECT d.is_active, d.user_id FROM drivers d WHERE d.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Driver not found' });

    const newStatus = !result.rows[0].is_active;
    const userId = result.rows[0].user_id;

    // Update drivers table
    await db.query('UPDATE drivers SET is_active = $1 WHERE id = $2', [newStatus, req.params.id]);
    // Also update users table so the driver cannot log in when deactivated
    await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, userId]);
    // If deactivating, force the driver offline so they stop receiving orders
    if (!newStatus) {
      await db.query("UPDATE drivers SET availability_status = 'offline' WHERE id = $1", [req.params.id]);
    }

    res.json({ message: 'Driver status updated', is_active: newStatus });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update driver shift
router.put('/drivers/:id/shifts', async (req, res) => {
  try {
    const { shifts } = req.body;
    await db.query('DELETE FROM driver_shifts WHERE driver_id = $1', [req.params.id]);

    for (const shift of shifts) {
      await db.query(
        'INSERT INTO driver_shifts (driver_id, day_of_week, start_time, end_time, is_active) VALUES ($1, $2, $3, $4, $5)',
        [req.params.id, shift.day_of_week, shift.start_time, shift.end_time, shift.is_active !== false]
      );
    }

    res.json({ message: 'Shifts updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Permanently delete a driver and all their data
router.delete('/drivers/:id', async (req, res) => {
  try {
    // Get the user_id AND avatar_url linked to this driver
    const driverResult = await db.query(
      'SELECT d.user_id, u.avatar_url FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = $1',
      [req.params.id]
    );
    if (driverResult.rows.length === 0)
      return res.status(404).json({ message: 'Driver not found' });

    const { user_id: userId, avatar_url: avatarUrl } = driverResult.rows[0];

    await db.query('BEGIN');

    // Nullify driver reference in orders (orders must be kept for history)
    await db.query('UPDATE orders SET driver_id = NULL WHERE driver_id = $1', [req.params.id]);

    // Delete payouts (no cascade from drivers table)
    await db.query('DELETE FROM driver_payouts WHERE driver_id = $1', [req.params.id]);

    // Nullify any activity log entries referencing this user
    await db.query('UPDATE activity_logs SET user_id = NULL WHERE user_id = $1', [userId]);

    // Delete chats the driver participated in (cascades to messages)
    await db.query(
      'DELETE FROM chats WHERE participant_1_id = $1 OR participant_2_id = $1',
      [userId]
    );

    // Delete the user — cascades to drivers → driver_shifts, earnings
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    await db.query('COMMIT');

    // Delete avatar file AFTER successful DB commit
    deleteAvatarFile(avatarUrl);

    res.json({ message: 'تم حذف حساب السائق بنجاح' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ message: error.message });
  }
});

// Permanently delete a customer and all their data
router.delete('/customers/:id', async (req, res) => {
  try {
    // id here is the users.id (returned by the /admin/customers query)
    // Also fetch avatar_url before deletion
    const customerResult = await db.query(
      'SELECT c.id, u.avatar_url FROM customers c JOIN users u ON c.user_id = u.id WHERE u.id = $1',
      [req.params.id]
    );
    if (customerResult.rows.length === 0)
      return res.status(404).json({ message: 'Customer not found' });

    const { id: customerId, avatar_url: avatarUrl } = customerResult.rows[0];

    await db.query('BEGIN');

    // Delete all orders belonging to this customer
    // (cascades to order_locations, order_items, receipts, earnings rows for those orders)
    await db.query('DELETE FROM orders WHERE customer_id = $1', [customerId]);

    // Delete chats the customer participated in (cascades to messages)
    await db.query(
      'DELETE FROM chats WHERE participant_1_id = $1 OR participant_2_id = $1',
      [req.params.id]
    );

    // Nullify activity log references
    await db.query('UPDATE activity_logs SET user_id = NULL WHERE user_id = $1', [req.params.id]);

    // Delete the user — cascades to the customers record
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    await db.query('COMMIT');

    // Delete avatar file AFTER successful DB commit
    deleteAvatarFile(avatarUrl);

    res.json({ message: 'تم حذف حساب العميل بنجاح' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ message: error.message });
  }
});

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    const { status, driver_id, date_from, date_to } = req.query;
    let query = `SELECT o.*, c.name as customer_name, d.name as driver_name, v.name_en as vehicle_name
      FROM orders o
      JOIN customers cust ON o.customer_id = cust.id
      JOIN users c ON cust.user_id = c.id
      LEFT JOIN drivers dr ON o.driver_id = dr.id
      LEFT JOIN users d ON dr.user_id = d.id
      JOIN vehicles v ON o.vehicle_id = v.id
      WHERE 1=1`;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    if (driver_id) {
      params.push(driver_id);
      query += ` AND o.driver_id = $${params.length}`;
    }
    if (date_from) {
      params.push(date_from);
      query += ` AND o.created_at >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND o.created_at <= $${params.length}`;
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get order details
router.get('/orders/:id', async (req, res) => {
  try {
    const orderResult = await db.query(
      `SELECT o.*,
         c.name as customer_name, c.phone as customer_phone,
         d.name as driver_name,
         pl.name_ar as pickup_location_name,
         dl.name_ar as dropoff_location_name
       FROM orders o
       JOIN customers cust ON o.customer_id = cust.id
       JOIN users c ON cust.user_id = c.id
       LEFT JOIN drivers dr ON o.driver_id = dr.id
       LEFT JOIN users d ON dr.user_id = d.id
       LEFT JOIN locations pl ON o.pickup_location_id  = pl.id
       LEFT JOIN locations dl ON o.dropoff_location_id = dl.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    const locations = await db.query(
      `SELECT ol.*, l.name_ar, l.name_en FROM order_locations ol
       LEFT JOIN locations l ON ol.location_id = l.id WHERE ol.order_id = $1 ORDER BY ol.sort_order`,
      [req.params.id]
    );

    const items = await db.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);

    res.json({ ...orderResult.rows[0], locations: locations.rows, items: items.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a single order
router.delete('/orders/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING id, order_number', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'الطلب غير موجود' });
    res.json({ message: `تم حذف الطلب ${result.rows[0].order_number}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete ALL orders history
router.delete('/orders', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM orders RETURNING id');
    res.json({ message: `تم حذف ${result.rows.length} طلب بنجاح` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Process payout
router.post('/payouts', async (req, res) => {
  try {
    const { driver_id, amount, notes } = req.body;

    await db.query('BEGIN');

    await db.query(
      'INSERT INTO driver_payouts (driver_id, amount, processed_by, notes) VALUES ($1, $2, $3, $4)',
      [driver_id, amount, req.user.id, notes]
    );

    await db.query(
      'UPDATE drivers SET unpaid_earnings = unpaid_earnings - $1 WHERE id = $2',
      [amount, driver_id]
    );

    await db.query(
      'UPDATE earnings SET is_paid = true, payout_id = (SELECT id FROM driver_payouts WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 1) WHERE driver_id = $1 AND is_paid = false',
      [driver_id]
    );

    await db.query('COMMIT');

    res.json({ message: 'Payout processed' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ message: error.message });
  }
});

// Get payout history
router.get('/payouts', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, d.name as driver_name, u.name as processed_by_name
       FROM driver_payouts p
       JOIN drivers dr ON p.driver_id = dr.id
       JOIN users d ON dr.user_id = d.id
       JOIN users u ON p.processed_by = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get complaints
router.get('/complaints', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.id as order_id, o.complaint, o.complaint_status, o.rating, o.review,
        o.created_at, c.name as customer_name, d.name as driver_name, o.order_number
       FROM orders o
       JOIN customers cust ON o.customer_id = cust.id
       JOIN users c ON cust.user_id = c.id
       LEFT JOIN drivers dr ON o.driver_id = dr.id
       LEFT JOIN users d ON dr.user_id = d.id
       WHERE o.complaint IS NOT NULL OR o.rating IS NOT NULL
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resolve complaint
router.put('/complaints/:orderId', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET complaint_status = $1 WHERE id = $2', [status, req.params.orderId]);
    res.json({ message: 'Complaint updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Driver Prepaid Balance Management ────────────────────────────────────────

// Add balance (deposit or adjustment) to a driver
router.post('/drivers/:id/balance', async (req, res) => {
  let client;
  try {
    const { amount, type = 'deposit', description } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount === 0) {
      return res.status(400).json({ message: 'أدخل مبلغاً صحيحاً غير صفري' });
    }
    if (!['deposit', 'adjustment'].includes(type)) {
      return res.status(400).json({ message: 'نوع المعاملة غير صالح' });
    }

    // Get driver
    client = await db.pool.connect();
    await client.query('BEGIN');
    const driverRes = await client.query('SELECT id, prepaid_balance, availability_status FROM drivers WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!driverRes.rows.length) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return res.status(404).json({ message: 'السائق غير موجود' });
    }
    const driver = driverRes.rows[0];

    // Adjustments preserve their sign; deposits always add a positive amount.
    const delta = type === 'adjustment' ? parsedAmount : Math.abs(parsedAmount);

    // Update balance directly in DB — allows negative balance (e.g. -50)
    const balResult = await client.query(
      'UPDATE drivers SET prepaid_balance = prepaid_balance + $1 WHERE id = $2 RETURNING prepaid_balance',
      [delta, req.params.id]
    );
    const newBalance = balResult.rows[0]?.prepaid_balance != null
      ? parseFloat(balResult.rows[0].prepaid_balance)
      : 0;

    await client.query(
      `INSERT INTO driver_balance_transactions
         (driver_id, type, amount, balance_after, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, type, type === 'adjustment' ? delta : Math.abs(delta), newBalance, description || (type === 'deposit' ? 'إيداع رصيد' : 'تعديل رصيد'), req.user.id]
    );

    // Re-enable driver if deposit brings balance above 0
    if (newBalance > 0 && driver.availability_status === 'offline') {
      await client.query("UPDATE drivers SET availability_status = 'available' WHERE id = $1", [req.params.id]);
    }
    // Force offline if balance at or below 0
    if (newBalance <= 0) {
      await client.query("UPDATE drivers SET availability_status = 'offline' WHERE id = $1", [req.params.id]);
    }

    await client.query('COMMIT');
    client.release();
    client = null;

    res.json({ message: 'تم تحديث الرصيد', prepaid_balance: newBalance });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    res.status(500).json({ message: error.message });
  }
});

// Set driver's standard renewal amount
router.put('/drivers/:id/renewal-amount', async (req, res) => {
  try {
    const { renewal_amount } = req.body;
    const parsed = parseFloat(renewal_amount);
    if (!parsed || parsed <= 0) return res.status(400).json({ message: 'المبلغ غير صالح' });

    await db.query(
      'UPDATE drivers SET balance_renewal_amount = $1 WHERE id = $2',
      [parsed, req.params.id]
    );
    res.json({ message: 'تم تحديث مبلغ التجديد', balance_renewal_amount: parsed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get full balance transaction history for a driver
router.get('/drivers/:id/balance-transactions', async (req, res) => {
  try {
    const txRes = await db.query(
      `SELECT t.*, o.order_number, u.name as created_by_name
       FROM driver_balance_transactions t
       LEFT JOIN orders o ON t.order_id = o.id
       LEFT JOIN users u  ON t.created_by = u.id
       WHERE t.driver_id = $1
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [req.params.id]
    );

    const driverRes = await db.query(
      `SELECT d.prepaid_balance, d.balance_renewal_amount, d.total_earnings, u.name
       FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [req.params.id]
    );
    if (!driverRes.rows.length) return res.status(404).json({ message: 'السائق غير موجود' });

    const driver = driverRes.rows[0];
    res.json({
      driver_name:            driver.name,
      prepaid_balance:        driver.prepaid_balance        != null ? parseFloat(driver.prepaid_balance)        : 0,
      balance_renewal_amount: driver.balance_renewal_amount != null ? parseFloat(driver.balance_renewal_amount) : 1000,
      total_earnings:         driver.total_earnings         != null ? parseFloat(driver.total_earnings)         : 0,
      transactions:           txRes.rows.map(t => ({
        ...t,
        amount:        parseFloat(t.amount),
        balance_after: parseFloat(t.balance_after),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;