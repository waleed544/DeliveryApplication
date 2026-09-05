const express = require('express');
const db = require('../config/db');
const router = express.Router();

router.get('/:audience', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title, image_url, sort_order FROM banners
       WHERE is_active = true AND (audience = $1 OR audience = 'both')
       ORDER BY sort_order, created_at DESC`,
      [req.params.audience]
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;