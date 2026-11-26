const router = require('express').Router()
const argon2 = require('argon2')
const crypto = require('node:crypto')
const { z } = require('zod')
const { pool } = require('../db')
const { encrypt, blindIndex } = require('../crypto')
const { requireRole } = require('../middleware/auth')

const userSchema = z.object({ email: z.string().email().max(254), name: z.string().trim().min(2).max(100), password: z.string().min(12).max(128), role: z.enum(['empleado', 'jefe']).default('empleado'), position: z.string().trim().max(100).optional() })

router.use(requireRole('jefe'))
router.get('/', async (_req, res, next) => { try { const { rows } = await pool.query('SELECT id, name, role, position, is_active, created_at FROM users ORDER BY created_at DESC'); res.json({ users: rows }) } catch (error) { next(error) } })
router.get('/events', async (_req, res, next) => { try { const { rows } = await pool.query('SELECT id, event_type, ip, user_agent, metadata, created_at FROM security_events ORDER BY created_at DESC LIMIT 100'); res.json({ events: rows }) } catch (error) { next(error) } })
router.post('/', async (req, res, next) => {
  try {
    const parsed = userSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos de cuenta inválidos' })
    const { email, name, password, role, position } = parsed.data
    const userId = crypto.randomUUID()
    const { rows } = await pool.query('INSERT INTO users (id, email_hash, email_enc, name, password_hash, role, position, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, role, position, is_active', [userId, blindIndex(email), encrypt(email, userId), name, await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }), role, position || null, req.user.id])
    await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'user_created', req.ip, req.get('user-agent'), JSON.stringify({ created_user_id: rows[0].id, role })])
    res.status(201).json({ user: rows[0] })
  } catch (error) { next(error) }
})
router.patch('/:id/status', async (req, res, next) => { try { const { rows } = await pool.query('UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active', [Boolean(req.body.isActive), req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Recurso no encontrado' }); res.json({ user: rows[0] }) } catch (error) { next(error) } })
router.patch('/:id/role', async (req, res, next) => { try { const role = z.enum(['empleado', 'jefe']).parse(req.body.role); const { rows } = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role', [role, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Recurso no encontrado' }); await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'role_changed', req.ip, req.get('user-agent'), JSON.stringify({ target_user_id: req.params.id, role })]); res.json({ user: rows[0] }) } catch (error) { next(error) } })

module.exports = router
