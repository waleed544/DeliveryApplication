const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const { calculateLocationBasedPricing } = require('../utils/calculations');
const socketManager = require('../socketManager');
const router = express.Router();

router.use(authenticate);

// Create order
router.post('/', async (req, res) => {
  let client;
  try {

    const {
      vehicle_id,
      service_type,
      locations,       // [{ location_id, custom_address, name }]
      items,
      customer_address,
      notes,
      promo_code,
      num_places,      // number of shopping places (1-5+)
      places_fee,      // fee charged for this stage
      place_details    // [{ name, description }]
    } = req.body;

    if (!vehicle_id || !service_type || !locations || !locations.length) {
      return res.status(400).json({ message: 'vehicle_id, service_type, and locations are required' });
    }

    // Check if platform is accepting orders
    const siteCheck = await db.query(
      "SELECT value FROM system_settings WHERE key = 'accepting_orders'"
    );
    if (siteCheck.rows.length > 0 && siteCheck.rows[0].value === 'false') {
      const msgRow = await db.query(
        "SELECT value FROM system_settings WHERE key = 'offline_message'"
      );
      const msg = msgRow.rows[0]?.value || 'المنصة غير متاحة حالياً، يرجى المحاولة لاحقاً.';
      return res.status(503).json({ message: msg, offline: true });
    }

    // Require at least one location to have a pricing location selected
    const hasPricingLocation = locations.some(l => l.location_id);
    if (!hasPricingLocation) {
      return res.status(400).json({ message: 'يجب اختيار منطقة تسعير واحدة على الأقل' });
    }

    const customerResult = await db.query(
      'SELECT c.id, u.phone FROM customers c JOIN users u ON c.user_id = u.id WHERE c.user_id = $1',
      [req.user.id]
    );
    if (customerResult.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    const customerId = customerResult.rows[0].id;
    const registeredPhone = customerResult.rows[0].phone; // always use account phone

    // Validate vehicle + get its type for surcharge calculation
    const vehicleResult = await db.query('SELECT type FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleResult.rows.length === 0) throw new Error('Invalid vehicle');
    const vehicleType = vehicleResult.rows[0].type; // 'motorcycle' | 'tuk_tuk' | 'car'

    const numLocations = locations.length;

    // ── Location-based pricing (includes vehicle surcharge) ───────────────────
    const locationIds = locations.map(l => l.location_id).filter(Boolean);
    const itemsSubtotal = items && items.length > 0
      ? items.reduce((sum, i) => sum + parseFloat(i.price || 0) * (parseInt(i.quantity) || 1), 0)
      : 0;

    const pricing = await calculateLocationBasedPricing(
      locationIds, service_type, itemsSubtotal, promo_code, parseFloat(places_fee) || 0, vehicleType
    );

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Create order and all dependent records atomically.
    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, vehicle_id, service_type, total_locations, delivery_fee, service_fee,
        items_subtotal, promo_discount, final_total, driver_earnings, owner_earnings, customer_phone, customer_address,
        notes, num_places, places_fee, place_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        customerId, vehicle_id, service_type, numLocations,
        pricing.deliveryFee, pricing.serviceFee, pricing.itemsSubtotal,
        pricing.promoDiscount, pricing.finalTotal, pricing.driverEarnings, pricing.ownerEarnings,
        registeredPhone, customer_address || '', notes || null,
        parseInt(num_places) || 1,
        parseFloat(places_fee) || 0,
        JSON.stringify(place_details || [])
      ]
    );

    const order = orderResult.rows[0];

    // Insert order locations (location_id = pricing area, custom_address = actual destination)
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      await client.query(
        `INSERT INTO order_locations (order_id, location_id, custom_address, location_name, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, loc.location_id || null, loc.custom_address || null, loc.name || null, i + 1]
      );
    }

    // Insert items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        const total = parseFloat(item.price) * (parseInt(item.quantity) || 1);
        await client.query(
          `INSERT INTO order_items (order_id, name, quantity, unit, price, total)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [order.id, item.name, item.quantity || 1, item.unit || 'piece', item.price, total]
        );
      }
    }

    // Update promo code usage — only when the discount was actually applied
    if (promo_code && pricing.promoDiscount > 0) {
      const promoUsage = await client.query(
        `UPDATE promo_codes SET used_count = used_count + 1
         WHERE code = $1 AND is_active = true
           AND (max_uses IS NULL OR used_count < max_uses)`,
        [promo_code.toUpperCase()]
      );
      if (promoUsage.rowCount !== 1) throw new Error('Promo code is no longer available');
    }

    // Update order status to finding driver
    await client.query("UPDATE orders SET status = 'finding_driver' WHERE id = $1", [order.id]);
    await client.query('COMMIT');
    client.release();
    client = null;

    // Notify all online, active, approved drivers with the matching vehicle type
    const eligibleDrivers = await db.query(
      `SELECT u.id as user_id
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       WHERE d.vehicle_id = $1
         AND d.availability_status = 'available'
         AND d.is_approved = true
         AND d.is_active = true
         AND COALESCE(d.prepaid_balance, 0) > 0`,
      [vehicle_id]
    );

    if (eligibleDrivers.rows.length > 0) {
      const driverUserIds = eligibleDrivers.rows.map(r => r.user_id);
      socketManager.emitNewOrder(driverUserIds, {
        ...order,
        status: 'finding_driver',
        location_count: numLocations
      });
    }

    res.status(201).json({ message: 'Order created', order });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    res.status(500).json({ message: error.message });
  }
});

// Preview pricing (before creating order) — now location-based + vehicle surcharge
router.post('/preview', async (req, res) => {
  try {
    const { location_ids, service_type, items_subtotal, promo_code, places_fee, vehicle_id } = req.body;

    if (!location_ids || !location_ids.length) {
      return res.status(400).json({ message: 'location_ids required' });
    }

    // Resolve vehicle type for surcharge calculation
    let vehicleType = 'motorcycle';
    if (vehicle_id) {
      const vRes = await db.query('SELECT type FROM vehicles WHERE id = $1', [vehicle_id]);
      if (vRes.rows.length > 0) vehicleType = vRes.rows[0].type;
    }

    const pricing = await calculateLocationBasedPricing(
      location_ids.filter(Boolean), service_type, items_subtotal || 0, promo_code, parseFloat(places_fee) || 0, vehicleType
    );

    // Also return per-location price breakdown for the review screen
    const validIds = location_ids.filter(Boolean);
    let locationBreakdown = [];
    if (validIds.length > 0) {
      const placeholders = validIds.map((_, i) => `$${i + 1}`).join(', ');
      const locResult = await db.query(
        `SELECT id, name_ar, name_en, delivery_price FROM locations WHERE id IN (${placeholders})`,
        validIds
      );
      locationBreakdown = locResult.rows;
    }

    res.json({ ...pricing, locationBreakdown });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Rate order
router.post('/rate/:orderId', async (req, res) => {
  try {
    const { rating, review, complaint } = req.body;
    const customerResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);

    await db.query(
      `UPDATE orders SET rating = $1, review = $2, complaint = $3
       WHERE id = $4 AND customer_id = $5 AND status = 'completed'`,
      [rating, review, complaint, req.params.orderId, customerResult.rows[0].id]
    );

    // Update driver rating
    const orderResult = await db.query('SELECT driver_id FROM orders WHERE id = $1', [req.params.orderId]);
    if (orderResult.rows.length > 0 && orderResult.rows[0].driver_id) {
      const driverId = orderResult.rows[0].driver_id;
      await db.query(
        `UPDATE drivers SET 
          rating_avg = (SELECT COALESCE(AVG(rating), 5) FROM orders WHERE driver_id = $1 AND rating IS NOT NULL),
          total_ratings = (SELECT COUNT(*) FROM orders WHERE driver_id = $1 AND rating IS NOT NULL)
         WHERE id = $1`,
        [driverId]
      );
    }

    res.json({ message: 'Rating submitted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Customer responds to driver's cost estimate ───────────────────────────────
router.put('/estimate-response/:orderId', async (req, res) => {
  try {
    const { approved } = req.body; // boolean

    // Confirm order belongs to this customer
    const customerResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
    if (customerResult.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });

    const orderCheck = await db.query(
      `SELECT o.id, o.driver_id,
        du.id as driver_user_id
       FROM orders o
       LEFT JOIN drivers dr ON o.driver_id = dr.id
       LEFT JOIN users du ON dr.user_id = du.id
       WHERE o.id = $1 AND o.customer_id = $2 AND o.estimate_status = 'pending'`,
      [req.params.orderId, customerResult.rows[0].id]
    );
    if (orderCheck.rows.length === 0) {
      return res.status(400).json({ message: 'No pending estimate for this order' });
    }

    const { driver_user_id } = orderCheck.rows[0];

    if (approved) {
      // Approve — update the order total to use the estimate amount so receipt matches
      const orderData = await db.query(
        `SELECT delivery_fee, service_fee, places_fee, promo_discount, estimate_total
           FROM orders WHERE id = $1`,
        [req.params.orderId]
      );
      if (orderData.rows.length > 0) {
        const o = orderData.rows[0];
        const estimateTotal  = parseFloat(o.estimate_total  || 0);
        const deliveryFee    = parseFloat(o.delivery_fee    || 0);
        const serviceFee     = parseFloat(o.service_fee     || 0);
        const placesFee      = parseFloat(o.places_fee      || 0);
        const promoDiscount  = parseFloat(o.promo_discount  || 0);
        const newFinalTotal  = deliveryFee + serviceFee + placesFee + estimateTotal - promoDiscount;

        await db.query(
          `UPDATE orders
             SET estimate_status = 'approved',
                 items_subtotal  = $1,
                 final_total     = $2
           WHERE id = $3`,
          [estimateTotal, newFinalTotal, req.params.orderId]
        );
      } else {
        await db.query(
          "UPDATE orders SET estimate_status = 'approved' WHERE id = $1",
          [req.params.orderId]
        );
      }
      socketManager.emitEstimateResponse(driver_user_id, {
        orderId: req.params.orderId, approved: true
      });
      res.json({ message: 'Estimate approved' });
    } else {
      // Reject — cancel the order
      await db.query(
        "UPDATE orders SET estimate_status = 'rejected', status = 'cancelled' WHERE id = $1",
        [req.params.orderId]
      );
      if (orderCheck.rows[0].driver_id) {
        await db.query(
          "UPDATE drivers SET availability_status = 'available' WHERE id = $1",
          [orderCheck.rows[0].driver_id]
        );
      }
      socketManager.emitEstimateResponse(driver_user_id, {
        orderId: req.params.orderId, approved: false
      });
      res.json({ message: 'Estimate rejected — order cancelled' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;