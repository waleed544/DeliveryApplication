const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

async function reindexDeliveryPrices(newItemId = null, newOrder = null) {
  const res = await db.query('SELECT id FROM delivery_route_prices ORDER BY sort_order ASC, created_at ASC');
  let items = res.rows.map(r => r.id);

  if (newItemId && newOrder !== null) {
    items = items.filter(id => id !== newItemId);
    const targetIndex = Math.max(0, Math.min(items.length, newOrder - 1));
    items.splice(targetIndex, 0, newItemId);
  }

  for (let i = 0; i < items.length; i++) {
    await db.query('UPDATE delivery_route_prices SET sort_order = $1 WHERE id = $2', [i + 1, items[i]]);
  }
}

router.use(authenticate);

// GET /delivery-prices — all active prices (for customers & order form)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT drp.*, 
        fl.name_ar as from_name_ar, fl.name_en as from_name_en,
        tl.name_ar as to_name_ar,   tl.name_en as to_name_en
       FROM delivery_route_prices drp
       JOIN locations fl ON drp.from_location_id = fl.id
       JOIN locations tl ON drp.to_location_id   = tl.id
       WHERE drp.is_active = true
       ORDER BY drp.sort_order ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /delivery-prices/lookup?from=<uuid>&to=<uuid>
// Bidirectional: if A→B exists, it also applies to B→A
router.get('/lookup', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'from and to are required' });
  try {
    const result = await db.query(
      `SELECT price FROM delivery_route_prices
       WHERE ((from_location_id = $1 AND to_location_id = $2)
          OR  (from_location_id = $2 AND to_location_id = $1))
         AND is_active = true
       LIMIT 1`,
      [from, to]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'لم يتم تحديد سعر لهذا المسار بعد' });
    res.json({ price: parseFloat(result.rows[0].price) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Admin-only CRUD ───────────────────────────────────────────────────────────

// GET /delivery-prices/admin — all prices including inactive (admin view)
router.get('/admin', authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT drp.*, 
        fl.name_ar as from_name_ar, fl.name_en as from_name_en,
        tl.name_ar as to_name_ar,   tl.name_en as to_name_en
       FROM delivery_route_prices drp
       JOIN locations fl ON drp.from_location_id = fl.id
       JOIN locations tl ON drp.to_location_id   = tl.id
       ORDER BY drp.sort_order ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /delivery-prices — create
router.post('/', authorize('admin'), async (req, res) => {
  const { from_location_id, to_location_id, price, sort_order } = req.body;
  if (!from_location_id || !to_location_id || price == null) {
    return res.status(400).json({ message: 'from_location_id, to_location_id, and price are required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO delivery_route_prices (from_location_id, to_location_id, price, sort_order)
       VALUES ($1, $2, $3, 999999)
       ON CONFLICT (from_location_id, to_location_id) 
       DO UPDATE SET price = EXCLUDED.price, is_active = true, updated_at = NOW()
       RETURNING *`,
      [from_location_id, to_location_id, parseFloat(price)]
    );
    const newItem = result.rows[0];

    if (sort_order !== undefined && sort_order !== null) {
      await reindexDeliveryPrices(newItem.id, parseInt(sort_order, 10));
    } else {
      await reindexDeliveryPrices();
    }

    const finalRes = await db.query(
      `SELECT drp.*, 
        fl.name_ar as from_name_ar, fl.name_en as from_name_en,
        tl.name_ar as to_name_ar,   tl.name_en as to_name_en
       FROM delivery_route_prices drp
       JOIN locations fl ON drp.from_location_id = fl.id
       JOIN locations tl ON drp.to_location_id   = tl.id
       WHERE drp.id = $1`,
      [newItem.id]
    );
    res.status(201).json(finalRes.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'هذا المسار موجود بالفعل' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /delivery-prices/:id — update price or active status
router.put('/:id', authorize('admin'), async (req, res) => {
  const { price, is_active, sort_order } = req.body;
  try {
    const result = await db.query(
      `UPDATE delivery_route_prices
       SET price     = COALESCE($1, price),
           is_active = COALESCE($2, is_active),
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [price != null ? parseFloat(price) : null, is_active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    
    if (sort_order !== undefined && sort_order !== null) {
      await reindexDeliveryPrices(req.params.id, parseInt(sort_order, 10));
    } else {
      await reindexDeliveryPrices();
    }

    const finalRes = await db.query(
      `SELECT drp.*, 
        fl.name_ar as from_name_ar, fl.name_en as from_name_en,
        tl.name_ar as to_name_ar,   tl.name_en as to_name_en
       FROM delivery_route_prices drp
       JOIN locations fl ON drp.from_location_id = fl.id
       JOIN locations tl ON drp.to_location_id   = tl.id
       WHERE drp.id = $1`,
      [req.params.id]
    );
    res.json(finalRes.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /delivery-prices/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM delivery_route_prices WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    await reindexDeliveryPrices();
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
