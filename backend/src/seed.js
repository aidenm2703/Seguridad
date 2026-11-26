require('dotenv').config()
const argon2 = require('argon2')
const { pool } = require('./db')
const { encrypt, blindIndex } = require('./crypto')

async function seed() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Administrador SecureVault'
  if (!email || !password) throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios para el seed')
  if (password.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres')
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
  const existing = await pool.query('SELECT id FROM users WHERE email_hash = $1', [blindIndex(email)])
  const userId = existing.rows[0]?.id || require('node:crypto').randomUUID()
  await pool.query('INSERT INTO users (id, email_hash, email_enc, name, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email_hash) DO UPDATE SET email_enc = EXCLUDED.email_enc, name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = \'jefe\'', [userId, blindIndex(email), encrypt(email, userId), name, hash, 'jefe'])
  console.log('Administrador inicial creado o actualizado')
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => pool.end())
