require('dotenv').config();
const db = require('./config/db');
async function m() {
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'normal'");
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_name VARCHAR(255)");
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_description TEXT");
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_phone VARCHAR(30)");
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS show_in_directory BOOLEAN DEFAULT true");
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_approved_commercial BOOLEAN DEFAULT false");
  await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_location_id INTEGER");
  console.log('Migration complete');
  process.exit(0);
}
m().catch(e => { console.error(e.message); process.exit(1); });
