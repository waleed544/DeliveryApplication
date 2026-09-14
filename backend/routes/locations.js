const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

async function reindexLocations(newItemId = null, newOrder = null) {
  const res = await db.query('SELECT id FROM locations ORDER BY sort_order ASC, created_at ASC');
  let items = res.rows.map(r => r.id);

  if (newItemId && newOrder !== null) {
    items = items.filter(id => id !== newItemId);
    const targetIndex = Math.max(0, Math.min(items.length, newOrder - 1));
    items.splice(targetIndex, 0, newItemId);
  }

  for (let i = 0; i < items.length; i++) {
    await db.query('UPDATE locations SET sort_order = $1 WHERE id = $2', [i + 1, items[i]]);
  }
}

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
       VALUES ($1, $2, $3, $4, $5, 999999) RETURNING *`,
      [name_ar, name_en, delivery_price, latitude, longitude]
    );
    const newLoc = result.rows[0];
    
    if (sort_order !== undefined && sort_order !== null) {
      await reindexLocations(newLoc.id, parseInt(sort_order, 10));
    } else {
      await reindexLocations(); // Just fix gaps
    }

    const finalRes = await db.query('SELECT * FROM locations WHERE id = $1', [newLoc.id]);
    res.status(201).json(finalRes.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin - update location
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name_ar, name_en, delivery_price, latitude, longitude, sort_order, is_active } = req.body;
    
    // First update the normal fields
    await db.query(
      `UPDATE locations SET name_ar = $1, name_en = $2, delivery_price = $3, latitude = $4,
       longitude = $5, is_active = $6 WHERE id = $7`,
      [name_ar, name_en, delivery_price, latitude, longitude, is_active, req.params.id]
    );

    // Then reindex to handle the sort_order correctly
    if (sort_order !== undefined && sort_order !== null) {
      await reindexLocations(req.params.id, parseInt(sort_order, 10));
    } else {
      await reindexLocations();
    }

    const finalRes = await db.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    res.json(finalRes.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin - delete location
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    await reindexLocations(); // Fix gaps after deletion
    res.json({ message: 'تم حذف المنطقة' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;