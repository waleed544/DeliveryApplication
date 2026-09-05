const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

// Public - get active locations
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM locations WHERE is_active = true ORDER BY sort_order, name_ar'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin - get all locations
router.get('/all', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM locations ORDER BY sort_order, name_ar');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin - create location
router.post('/', authenticate, async (req, res) => {
  try {
    const { name_ar, name_en, delivery_price, latitude, longitude, sort_order } = req.body;
    const result = await db.query(
      `INSERT INTO locations (name_ar, name_en, delivery_price, latitude, longitude, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name_ar, name_en, delivery_price, latitude, longitude, sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin - update location
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name_ar, name_en, delivery_price, latitude, longitude, sort_order, is_active } = req.body;
    const result = await db.query(
      `UPDATE locations SET name_ar = $1, name_en = $2, delivery_price = $3, latitude = $4,
       longitude = $5, sort_order = $6, is_active = $7 WHERE id = $8 RETURNING *`,
      [name_ar, name_en, delivery_price, latitude, longitude, sort_order, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin - delete location
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;