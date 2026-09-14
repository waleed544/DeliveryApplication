const { pool } = require('../backend/config/db');

async function migrate() {
  try {
    console.log('Creating device_tokens table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (
          (user_id IS NOT NULL AND driver_id IS NULL) OR 
          (user_id IS NULL AND driver_id IS NOT NULL)
        )
      );
    `);
    console.log('device_tokens table created successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
