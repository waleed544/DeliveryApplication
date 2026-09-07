require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Add delivery_service to service_type enum
    try {
      await client.query("ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'delivery_service'");
      console.log('✓ delivery_service added to service_type enum');
    } catch(e) { console.log('⏭ service_type:', e.message); }

    // 2. Add delivery columns to orders (one at a time)
    const cols = [
      ['delivery_sub_type',   'VARCHAR(10)'],
      ['pickup_location_id',  'UUID REFERENCES locations(id)'],
      ['pickup_address',      'TEXT'],
      ['dropoff_location_id', 'UUID REFERENCES locations(id)'],
      ['dropoff_address',     'TEXT'],
    ];
    for (const [col, type] of cols) {
      try {
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        console.log(`✓ Added column orders.${col}`);
      } catch(e) { console.log(`⏭ ${col}:`, e.message); }
    }

    // 3. Create delivery_route_prices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_route_prices (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        to_location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        price            DECIMAL(10, 2) NOT NULL DEFAULT 0,
        is_active        BOOLEAN NOT NULL DEFAULT true,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (from_location_id, to_location_id)
      )
    `);
    console.log('✓ delivery_route_prices table created (or already exists)');

    // 4. Create indexes
    try { await client.query('CREATE INDEX IF NOT EXISTS idx_delivery_prices_from ON delivery_route_prices(from_location_id)'); console.log('✓ index from'); } catch(e) {}
    try { await client.query('CREATE INDEX IF NOT EXISTS idx_delivery_prices_to   ON delivery_route_prices(to_location_id)'); console.log('✓ index to'); } catch(e) {}

    // 5. Add new order_status values
    for (const val of ['going_to_pickup', 'arrived_at_pickup']) {
      try {
        await client.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${val}'`);
        console.log(`✓ Added status: ${val}`);
      } catch(e) { console.log(`⏭ ${val}:`, e.message); }
    }

    console.log('\n✅ Migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
