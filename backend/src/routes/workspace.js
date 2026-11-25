const router = require('express').Router()
const { z } = require('zod')
const { pool } = require('../db')
const { encrypt, decrypt } = require('../crypto')

const activitySchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).default(''), startAt: z.string().datetime(), endAt: z.string().datetime(), status: z.enum(['pendiente', 'en_curso', 'hecha']).default('pendiente'), priority: z.enum(['baja', 'media', 'alta']).default('media') })

router.get('/summary', async (req, res, next) => { try { const [activities, announcements] = await Promise.all([pool.query('SELECT id, title_enc, description_enc, start_at, end_at, status, priority FROM activities WHERE owner_id = $1 ORDER BY start_at LIMIT 50', [req.user.id]), pool.query('SELECT id, title, body, pinned, created_at FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 10')]); res.json({ activities: activities.rows.map((row) => ({ ...row, title: decrypt(row.title_enc, req.user.id), description: decrypt(row.description_enc, req.user.id) })), announcements: announcements.rows }) } catch (error) { next(error) } })
router.post('/activities', async (req, res, next) => { try { const parsed = activitySchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Actividad inválida' }); const a = parsed.data; const { rows } = await pool.query('INSERT INTO activities (owner_id, title_enc, description_enc, start_at, end_at, status, priority) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, start_at, end_at, status, priority', [req.user.id, encrypt(a.title, req.user.id), encrypt(a.description, req.user.id), a.startAt, a.endAt, a.status, a.priority]); res.status(201).json({ activity: { ...rows[0], title: a.title, description: a.description } }) } catch (error) { next(error) } })
router.delete('/activities/:id', async (req, res, next) => { try { const { rowCount } = await pool.query('DELETE FROM activities WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]); if (!rowCount) return res.status(404).json({ error: 'Recurso no encontrado' }); res.status(204).end() } catch (error) { next(error) } })

module.exports = router
