const router = require('express').Router()
const argon2 = require('argon2')
const crypto = require('node:crypto')
const { z } = require('zod')
const { pool } = require('../db')
const { blindIndex } = require('../crypto')

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) })

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(401).json({ error: 'Credenciales inválidas' })
    const emailHash = blindIndex(parsed.data.email)
    const result = await pool.query('SELECT id, name, role, password_hash, is_active, failed_attempts, locked_until FROM users WHERE email_hash = $1', [emailHash])
    const user = result.rows[0]
    const locked = user?.locked_until && new Date(user.locked_until) > new Date()
    const valid = user && user.is_active && !locked && await argon2.verify(user.password_hash, parsed.data.password)
    if (!valid) {
      if (user) await pool.query('UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL \'15 minutes\' ELSE locked_until END WHERE id = $1', [user.id])
      await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [user?.id || null, 'login_failed', req.ip, req.get('user-agent'), JSON.stringify({})])
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }
    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id])
    await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [user.id, 'login_success', req.ip, req.get('user-agent'), JSON.stringify({})])
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
    req.session.user = { id: user.id, name: user.name, role: user.role }
    res.json({ user: req.session.user })
  } catch (error) { next(error) }
})

router.post('/logout', (req, res, next) => req.session.destroy((error) => error ? next(error) : res.status(204).end()))
router.get('/me', (req, res) => req.session.user ? res.json({ user: req.session.user }) : res.status(401).json({ error: 'Autenticación requerida' }))
router.post('/password-reset/request', async (_req, res) => res.json({ message: 'Si la cuenta existe, recibirás instrucciones para recuperar el acceso.' }))

module.exports = router
