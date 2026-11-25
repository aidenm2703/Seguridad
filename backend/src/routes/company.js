const router = require('express').Router()
const { z } = require('zod')
const { pool } = require('../db')
const { requireRole } = require('../middleware/auth')

const announcementSchema = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(3000), pinned: z.boolean().default(false) })
router.get('/announcements', async (_req, res, next) => { try { const { rows } = await pool.query('SELECT id, title, body, pinned, created_at FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 50'); res.json({ announcements: rows }) } catch (error) { next(error) } })
router.post('/announcements', requireRole('jefe'), async (req, res, next) => { try { const parsed = announcementSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Anuncio inválido' }); const { title, body, pinned } = parsed.data; const { rows } = await pool.query('INSERT INTO announcements (title, body, pinned, created_by) VALUES ($1, $2, $3, $4) RETURNING id, title, body, pinned, created_at', [title, body, pinned, req.user.id]); res.status(201).json({ announcement: rows[0] }) } catch (error) { next(error) } })
module.exports = router
