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
  await pool.query('INSERT INTO users (email_hash, email_enc, name, password_hash, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email_hash) DO UPDATE SET name = EXCLUDED.name, role = \'jefe\'', [blindIndex(email), encrypt(email, 'seed'), name, hash])
  console.log('Administrador inicial creado o actualizado')
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => pool.end())
