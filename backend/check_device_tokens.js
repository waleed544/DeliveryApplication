const { pool } = require('./config/db');
const q = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='device_tokens' ORDER BY ordinal_position";
pool.query(q)
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
