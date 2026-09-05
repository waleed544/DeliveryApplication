const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');

async function run() {
  try {
    await db.query(`
      WITH settings AS (
        SELECT
          COALESCE(MAX(value) FILTER (WHERE key = 'driver_percentage'), 80) AS driver_percentage,
          COALESCE(MAX(value) FILTER (WHERE key = 'owner_percentage'), 20) AS owner_percentage
        FROM pricing_settings
      ),
      bases AS (
        SELECT
          o.id,
          (o.delivery_fee + o.service_fee + COALESCE(o.places_fee, 0)) AS fee_profit_base,
          (o.delivery_fee + o.service_fee + COALESCE(o.places_fee, 0) + COALESCE(o.items_subtotal, 0)) AS subtotal,
          COALESCE(o.promo_discount, 0) AS promo_discount
        FROM orders o
      )
      UPDATE orders o
      SET
        driver_earnings = ROUND(GREATEST(0, b.fee_profit_base - CASE WHEN b.subtotal > 0 THEN b.promo_discount * b.fee_profit_base / b.subtotal ELSE 0 END) * s.driver_percentage / 100, 2),
        owner_earnings = ROUND(GREATEST(0, b.fee_profit_base - CASE WHEN b.subtotal > 0 THEN b.promo_discount * b.fee_profit_base / b.subtotal ELSE 0 END) * s.owner_percentage / 100, 2)
      FROM bases b, settings s
      WHERE o.id = b.id AND o.promo_discount > 0;
    `);
    console.log('Recalculated earnings for discounted orders.');
  } finally {
    await db.pool.end();
  }
}

run().catch(error => {
  console.error('Discounted earnings migration failed:', error.message);
  process.exit(1);
});