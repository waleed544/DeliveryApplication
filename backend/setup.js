/**
 * ============================================================
 *  setup.js — Run ONCE after schema.sql on a fresh database
 * ============================================================
 *
 *  Sequence:
 *    1. createdb delivery_platform          (create the DB)
 *    2. psql -d delivery_platform -f database/schema.sql   (create tables + seed static data)
 *    3. node backend/setup.js              (this file — create users)
 *
 *  Safe to re-run: uses ON CONFLICT DO NOTHING everywhere.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function setup() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║         🚀  Project Setup            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // ── Verify schema was already applied ─────────────────────────────────────
  const tables = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('vehicles','locations','pricing_settings','place_count_options','users')
  `);
  const found = tables.rows.map(r => r.table_name);
  const required = ['vehicles', 'locations', 'pricing_settings', 'users'];
  const missing = required.filter(t => !found.includes(t));
  if (missing.length > 0) {
    console.error('❌ Missing tables:', missing.join(', '));
    console.error('   → Run schema.sql first:');
    console.error('     psql -d delivery_platform -f database/schema.sql');
    process.exit(1);
  }

  // ── Verify schema seeded static data ──────────────────────────────────────
  const [vc, lc, pc] = await Promise.all([
    db.query('SELECT COUNT(*) FROM vehicles'),
    db.query('SELECT COUNT(*) FROM locations'),
    db.query('SELECT COUNT(*) FROM pricing_settings'),
  ]);
  console.log('📊 Schema data check:');
  console.log(`   vehicles:         ${vc.rows[0].count} rows  (expected ≥ 3)`);
  console.log(`   locations:        ${lc.rows[0].count} rows  (expected ≥ 1)`);
  console.log(`   pricing_settings: ${pc.rows[0].count} rows  (expected ≥ 9)`);
  console.log('');

  if (parseInt(vc.rows[0].count) === 0) {
    console.error('❌ No vehicles found — did schema.sql run correctly?');
    process.exit(1);
  }

  // ── Get motorcycle ID for driver ───────────────────────────────────────────
  const moto = await db.query("SELECT id FROM vehicles WHERE type = 'motorcycle' LIMIT 1");
  const motorcycleId = moto.rows[0].id;

  console.log('👤 Creating users...');

  // ── Admin ──────────────────────────────────────────────────────────────────
  const adminPwd = await bcrypt.hash('admin123', 10);
  const adminRes = await db.query(`
    INSERT INTO users (phone, email, password_hash, name, role, is_active)
    VALUES ('01000000000', 'admin@delivery.com', $1, 'System Admin', 'admin', true)
    ON CONFLICT (phone) DO NOTHING RETURNING id`,
    [adminPwd]
  );
  console.log(adminRes.rows.length > 0
    ? '   ✓ Admin created'
    : '   ℹ Admin already exists');

  // ── Customer ───────────────────────────────────────────────────────────────
  const custPwd = await bcrypt.hash('customer123', 10);
  const custRes = await db.query(`
    INSERT INTO users (phone, email, password_hash, name, role, is_active)
    VALUES ('01011111111', 'customer@example.com', $1, 'Ahmed Customer', 'customer', true)
    ON CONFLICT (phone) DO NOTHING RETURNING id`,
    [custPwd]
  );
  if (custRes.rows.length > 0) {
    await db.query(
      'INSERT INTO customers (user_id, default_address) VALUES ($1, $2)',
      [custRes.rows[0].id, 'Tanta, El Gharbia']
    );
    console.log('   ✓ Customer created');
  } else {
    console.log('   ℹ Customer already exists');
  }

  // ── Driver ─────────────────────────────────────────────────────────────────
  const drvPwd = await bcrypt.hash('driver123', 10);
  const drvRes = await db.query(`
    INSERT INTO users (phone, email, password_hash, name, role, is_active)
    VALUES ('01022222222', 'driver@example.com', $1, 'Mohamed Driver', 'driver', true)
    ON CONFLICT (phone) DO NOTHING RETURNING id`,
    [drvPwd]
  );

  let driverUserId;
  if (drvRes.rows.length > 0) {
    driverUserId = drvRes.rows[0].id;
    console.log('   ✓ Driver user created');
  } else {
    const ex = await db.query("SELECT id FROM users WHERE phone = '01022222222'");
    driverUserId = ex.rows[0].id;
    console.log('   ℹ Driver user already exists');
  }

  // Ensure drivers profile row exists and is approved
  const drvProfile = await db.query('SELECT id, is_approved FROM drivers WHERE user_id = $1', [driverUserId]);
  if (drvProfile.rows.length === 0) {
    await db.query(`
      INSERT INTO drivers (user_id, vehicle_id, vehicle_plate, national_id, is_approved, availability_status)
      VALUES ($1, $2, 'م ن ا 1234', '12345678901234', true, 'available')`,
      [driverUserId, motorcycleId]
    );
    console.log('   ✓ Driver profile created (approved)');
  } else if (!drvProfile.rows[0].is_approved) {
    await db.query(
      "UPDATE drivers SET is_approved = true, availability_status = 'available' WHERE user_id = $1",
      [driverUserId]
    );
    console.log('   ✓ Driver profile approved');
  } else {
    console.log('   ℹ Driver profile already approved');
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║           ✅  Setup Complete         ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║  Admin    → 01000000000 / admin123   ║');
  console.log('║  Customer → 01011111111 / customer123║');
  console.log('║  Driver   → 01022222222 / driver123  ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  process.exit(0);
}

setup().catch(e => {
  console.error('\n❌ Setup failed:', e.message);
  process.exit(1);
});
