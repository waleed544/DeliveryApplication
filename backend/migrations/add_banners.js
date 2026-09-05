const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');

async function run() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(150),
        image_url TEXT NOT NULL,
        audience VARCHAR(20) NOT NULL DEFAULT 'both' CHECK (audience IN ('customer', 'driver', 'both')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_banners_audience_active ON banners(audience, is_active, sort_order);
    `);
    console.log('Banners migration completed successfully.');
  } finally {
    await db.pool.end();
  }
}

run().catch(error => {
  console.error('Banners migration failed:', error.message);
  process.exit(1);
});