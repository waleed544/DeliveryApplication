const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

router.use(authenticate);

// Get customer profile
router.get('/profile', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT c.*, u.name, u.phone, u.email, u.avatar_url FROM customers c JOIN users u ON c.user_id = u.id WHERE u.id = $1',
      [req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update profile (customer-specific fields; name+phone are handled by /api/users/profile)
router.put('/profile', async (req, res) => {
  try {
    const { name, email, default_address, addresses } = req.body;
    // Keep name + email in sync on users table too
    if (name) await db.query('UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3', [name, email || null, req.user.id]);
    await db.query(
      'UPDATE customers SET default_address = $1, addresses = $2 WHERE user_id = $3',
      [default_address || null, JSON.stringify(addresses || []), req.user.id]
    );
    res.json({ message: 'تم تحديث الملف الشخصي' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get customer orders
router.get('/orders', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, v.name_ar as vehicle_name_ar, v.name_en as vehicle_name_en, v.icon,
        d.name as driver_name, d.phone as driver_phone
       FROM orders o
       JOIN vehicles v ON o.vehicle_id = v.id
       LEFT JOIN (SELECT dr.id, u.name, u.phone FROM drivers dr JOIN users u ON dr.user_id = u.id) d ON o.driver_id = d.id
       WHERE o.customer_id = (SELECT id FROM customers WHERE user_id = $1)
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single order with details
router.get('/orders/:id', async (req, res) => {
  try {
    const orderResult = await db.query(
      `SELECT o.*, v.name_ar as vehicle_name_ar, v.name_en as vehicle_name_en, v.icon,
        d.name as driver_name, d.phone as driver_phone, d.avatar_url as driver_avatar,
        d.user_id as driver_user_id
       FROM orders o
       JOIN vehicles v ON o.vehicle_id = v.id
       LEFT JOIN (SELECT dr.id, dr.user_id, u.name, u.phone, u.avatar_url FROM drivers dr JOIN users u ON dr.user_id = u.id) d ON o.driver_id = d.id
       WHERE o.id = $1 AND o.customer_id = (SELECT id FROM customers WHERE user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    const order = orderResult.rows[0];

    const locationsResult = await db.query(
      `SELECT ol.*, l.name_ar, l.name_en, l.delivery_price
       FROM order_locations ol
       LEFT JOIN locations l ON ol.location_id = l.id
       WHERE ol.order_id = $1 ORDER BY ol.sort_order`,
      [req.params.id]
    );

    const itemsResult = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [req.params.id]
    );

    const receiptResult = await db.query(
      'SELECT * FROM receipts WHERE order_id = $1',
      [req.params.id]
    );

    res.json({
      ...order,
      locations: locationsResult.rows,
      items: itemsResult.rows,
      receipt: receiptResult.rows[0] || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Customer cancels their own order — only while still searching for a driver
router.post('/cancel-order/:id', async (req, res) => {
  try {
    const customerId = await db.query(
      'SELECT id FROM customers WHERE user_id = $1',
      [req.user.id]
    );
    if (customerId.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });

    // Only allow cancel when the order belongs to this customer AND is still finding_driver
    const orderResult = await db.query(
      `UPDATE orders SET status = 'cancelled'
       WHERE id = $1
         AND customer_id = $2
         AND status = 'finding_driver'
       RETURNING id`,
      [req.params.id, customerId.rows[0].id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(400).json({ message: 'لا يمكن إلغاء الطلب — ربما تم قبوله بالفعل أو أُلغي مسبقاً' });
    }

    // Notify via socket (no driver yet, so driverUserId is null)
    const socketManager = require('../socketManager');
    socketManager.emitToUser(req.user.id, 'order_update', {
      orderId: req.params.id,
      status: 'cancelled'
    });

    res.json({ message: 'تم إلغاء الطلب بنجاح' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;