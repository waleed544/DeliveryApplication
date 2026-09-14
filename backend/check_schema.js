const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_route_prices'`)
.then(r => {
  console.log(r.rows);
  p.end();
}).catch(console.error);
