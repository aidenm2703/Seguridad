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
router.post('/password-reset/request', async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email().max(254) }).safeParse(req.body)
    if (parsed.success) {
      const { rows } = await pool.query('SELECT id FROM users WHERE email_hash = $1 AND is_active = TRUE', [blindIndex(parsed.data.email)])
      if (rows[0]) {
        const token = crypto.randomBytes(32).toString('base64url')
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
        await pool.query('DELETE FROM password_resets WHERE user_id = $1 OR expires_at < NOW()', [rows[0].id])
        await pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [rows[0].id, tokenHash])
        // Delivery is intentionally delegated to the configured SMTP provider; the token is never returned or logged.
      }
    }
    res.json({ message: 'Si la cuenta existe, recibirás instrucciones para recuperar el acceso.' })
  } catch (error) { next(error) }
})
router.post('/password-reset/complete', async (req, res, next) => {
  try {
    const parsed = z.object({ token: z.string().min(40).max(100), password: z.string().min(12).max(128) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Solicitud inválida' })
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
    const { rows } = await pool.query('UPDATE users SET password_hash = $1 WHERE id = (SELECT user_id FROM password_resets WHERE token_hash = $2 AND used_at IS NULL AND expires_at > NOW()) RETURNING id', [passwordHash, tokenHash])
    if (!rows[0]) return res.status(400).json({ error: 'Token inválido o expirado' })
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1', [tokenHash])
    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) { next(error) }
})

module.exports = router
