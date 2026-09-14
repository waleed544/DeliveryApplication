const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    console.log('Adding sort_order to delivery_route_prices...');
    await p.query(`ALTER TABLE delivery_route_prices ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
    
    // Also, initialize any existing NULL sort_orders to 0 just in case
    await p.query(`UPDATE delivery_route_prices SET sort_order = 0 WHERE sort_order IS NULL`);
    await p.query(`UPDATE locations SET sort_order = 0 WHERE sort_order IS NULL`);

    console.log('Migration complete.');
  } catch (err) {
    console.error(err);
  } finally {
    p.end();
  }
}

migrate();
