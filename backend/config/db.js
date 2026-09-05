const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../.env')
});

// Railway provides DATABASE_URL.
// Local development can still use DB_HOST, DB_PORT, etc.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'delivery_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      options: `-c timezone=${process.env.DB_TIMEZONE || 'Africa/Cairo'}`
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

