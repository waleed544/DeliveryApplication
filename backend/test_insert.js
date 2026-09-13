require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);
    const phone = '01' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const userResult = await pool.query(
      'INSERT INTO users (phone, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [phone, null, hashedPassword, 'Test Name', 'customer']
    );
    const user = userResult.rows[0];
    
    // Simulate commercial insert
    await pool.query(
      `INSERT INTO customers (user_id, account_type, business_name, business_location_id, business_phone, business_description, is_approved_commercial)
       VALUES ($1, 'commercial', $2, $3, $4, $5, false)`,
      [user.id, 'My Biz', null, '012', 'Desc']
    );
    
    console.log("Success! Now deleting test user...");
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log("Deleted.");
  } catch (err) {
    console.error("DB Error =>", err.message);
    if (err.detail) console.error("Detail =>", err.detail);
    if (err.constraint) console.error("Constraint =>", err.constraint);
  } finally {
    pool.end();
  }
}
test();
