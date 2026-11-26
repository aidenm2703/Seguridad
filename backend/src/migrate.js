require('dotenv').config()
const fs = require('node:fs/promises')
const path = require('node:path')
const { pool } = require('./db')
const { encrypt } = require('./crypto')

async function migrate() {
  const sql = await fs.readFile(path.join(__dirname, '..', 'db', '001_initial.sql'), 'utf8')
  await pool.query(sql)
  const { rows } = await pool.query('SELECT id, owner_id, start_at, end_at FROM activities WHERE start_enc IS NULL AND start_at IS NOT NULL')
  for (const row of rows) {
    await pool.query('UPDATE activities SET start_enc = $1, end_enc = $2, start_at = NULL, end_at = NULL WHERE id = $3', [encrypt(row.start_at.toISOString(), row.owner_id), encrypt(row.end_at.toISOString(), row.owner_id), row.id])
  }
  console.log('Migración aplicada')
}

migrate().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => pool.end())
