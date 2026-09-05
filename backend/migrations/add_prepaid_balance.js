/**
 * Migration: Driver Prepaid Balance System
 * Adds prepaid_balance and balance_renewal_amount to drivers.
 * Creates driver_balance_transactions table.
 */
const db = require('../config/db');

async function migrate() {
  console.log('🚀 Starting prepaid balance migration...');

  await db.query(`
    ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS prepaid_balance       DECIMAL(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS balance_renewal_amount DECIMAL(10,2) NOT NULL DEFAULT 1000;
  `);
  console.log('✅ Added prepaid_balance and balance_renewal_amount to drivers');

  await db.query(`
    CREATE TABLE IF NOT EXISTS driver_balance_transactions (
      id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
      driver_id      UUID          NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      type           VARCHAR(20)   NOT NULL CHECK (type IN ('deposit', 'deduction', 'adjustment')),
      amount         DECIMAL(10,2) NOT NULL,
      balance_after  DECIMAL(10,2) NOT NULL,
      description    TEXT,
      order_id       UUID          REFERENCES orders(id) ON DELETE SET NULL,
      created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_bal_tx_driver ON driver_balance_transactions(driver_id);
    CREATE INDEX IF NOT EXISTS idx_bal_tx_order  ON driver_balance_transactions(order_id);
  `);
  console.log('✅ Created driver_balance_transactions table');

  // Zero out legacy unpaid_earnings (system is now inverted — drivers pre-pay)
  await db.query(`UPDATE drivers SET unpaid_earnings = 0`);
  console.log('✅ Zeroed legacy unpaid_earnings');

  console.log('🎉 Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
