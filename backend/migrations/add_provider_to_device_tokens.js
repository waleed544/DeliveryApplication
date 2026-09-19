/**
 * Migration: add `provider` column to device_tokens
 * Values: 'fcm' (default, existing rows) | 'hms' (Huawei)
 */
const { pool } = require('../config/db');

async function run() {
  try {
    await pool.query(`
      ALTER TABLE device_tokens
      ADD COLUMN IF NOT EXISTS provider VARCHAR(10) NOT NULL DEFAULT 'fcm'
    `);
    console.log("✅ Added 'provider' column to device_tokens (default='fcm')");
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
