require('dotenv').config()
const fs = require('node:fs/promises')
const path = require('node:path')
const { pool } = require('./db')

async function migrate() {
  const sql = await fs.readFile(path.join(__dirname, '..', 'db', '001_initial.sql'), 'utf8')
  await pool.query(sql)
  console.log('Migración aplicada')
}

migrate().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => pool.end())
