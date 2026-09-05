const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

// ── Public: get all active options (used by customer order flow) ─────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM place_count_options WHERE is_active = true ORDER BY sort_order ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Admin: get ALL options (including inactive) ───────────────────────────────
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM place_count_options ORDER BY sort_order ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Admin: create new option ──────────────────────────────────────────────────
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { label_ar, min_places, is_open_ended, price, sort_order, is_active } = req.body;
    if (!label_ar || min_places === undefined || price === undefined) {
      return res.status(400).json({ message: 'label_ar, min_places, and price are required' });
    }
    const result = await db.query(
      `INSERT INTO place_count_options (label_ar, min_places, is_open_ended, price, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        label_ar,
        parseInt(min_places),
        is_open_ended === true || is_open_ended === 'true',
        parseFloat(price),
        parseInt(sort_order) || 0,
        is_active !== false
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Admin: update option ──────────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { label_ar, min_places, is_open_ended, price, sort_order, is_active } = req.body;
    const result = await db.query(
      `UPDATE place_count_options
       SET label_ar = $1, min_places = $2, is_open_ended = $3, price = $4,
           sort_order = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        label_ar,
        parseInt(min_places),
        is_open_ended === true || is_open_ended === 'true',
        parseFloat(price),
        parseInt(sort_order) || 0,
        is_active !== false,
        req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Option not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Admin: delete option ──────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM place_count_options WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Option not found' });
    res.json({ message: 'Option deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
