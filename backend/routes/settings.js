const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

// Get system settings (public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM system_settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update system settings (admin)
router.put('/:key', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { value } = req.body;
    await db.query(
      'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2',
      [value, req.params.key]
    );
    res.json({ message: 'Setting updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Promo codes
router.get('/promo-codes', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/promo-codes', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { code, discount_value, max_uses, min_order_amount, expires_at } = req.body;
    if (!code || Number(discount_value) <= 0) {
      return res.status(400).json({ message: 'Code and a positive fixed discount are required' });
    }
    const result = await db.query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, min_order_amount, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code.trim().toUpperCase(), 'fixed', Number(discount_value), max_uses || null, min_order_amount || 0, expires_at || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/promo-codes/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE promo_codes SET is_active = $1 WHERE id = $2', [is_active, req.params.id]);
    res.json({ message: 'Promo code updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.delete('/promo-codes/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM promo_codes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Promo code not found' });
    }
    res.json({ message: 'Promo code deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;