const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
})

module.exports = { pool }
