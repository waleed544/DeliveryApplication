const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

router.use(authenticate);

// Get all pricing settings
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pricing_settings ORDER BY key');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update pricing (admin only)
router.put('/:key', authorize('admin'), async (req, res) => {
  try {
    const { value, description } = req.body;
    const result = await db.query(
      'UPDATE pricing_settings SET value = $1, description = $2, updated_at = NOW() WHERE key = $3 RETURNING *',
      [value, description, req.params.key]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;