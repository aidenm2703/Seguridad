const router = require('express').Router()
const crypto = require('node:crypto')
const { z } = require('zod')
const { pool } = require('../db')
const { encrypt, decrypt } = require('../crypto')
const { requireRole } = require('../middleware/auth')
const { sendActivityCompletionNotification } = require('../mailer')

const activitySchema = z.object({
  assigneeId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  priority: z.enum(['baja', 'media', 'alta']).default('media'),
  visibility: z.enum(['private', 'all', 'selected']).default('private'),
  selectedUserIds: z.array(z.string().uuid()).max(100).default([]),
})
const completionSchema = z.object({ note: z.string().trim().max(2000).default('') })

function decryptActivity(row) {
  const ownerId = row.owner_id
  return {
    id: row.id, ownerId, assignedBy: row.assigned_by,
    title: decrypt(row.title_enc, ownerId), description: decrypt(row.description_enc, ownerId),
    startAt: row.start_enc ? decrypt(row.start_enc, ownerId) : row.start_at,
    endAt: row.end_enc ? decrypt(row.end_enc, ownerId) : row.end_at,
    status: row.status, priority: row.priority, visibility: row.calendar_visibility,
    completedAt: row.completed_at, assigneeName: row.assignee_name,
  }
}

router.get('/summary', async (req, res, next) => {
  try {
    const isBoss = req.user.role === 'jefe'
    const activityQuery = isBoss
      ? 'SELECT a.*, u.name AS assignee_name FROM activities a JOIN users u ON u.id = a.owner_id ORDER BY a.created_at DESC LIMIT 100'
      : 'SELECT a.*, u.name AS assignee_name FROM activities a JOIN users u ON u.id = a.owner_id WHERE a.owner_id = $1 OR a.calendar_visibility = \'all\' OR (a.calendar_visibility = \'selected\' AND $1 = ANY(a.calendar_targets)) ORDER BY a.created_at DESC LIMIT 100'
    const [activities, announcements] = await Promise.all([
      pool.query(activityQuery, isBoss ? [] : [req.user.id]),
      pool.query('SELECT id, title, body, pinned, created_at FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 10'),
    ])
    let activityReports = []; let assignees = []
    if (isBoss) {
      const reports = await pool.query('SELECT r.id, r.activity_id, r.note_enc, r.completed_at, u.name AS employee_name, a.title_enc, a.owner_id FROM activity_reports r JOIN users u ON u.id = r.employee_id JOIN activities a ON a.id = r.activity_id ORDER BY r.completed_at DESC LIMIT 50')
      activityReports = reports.rows.map((row) => ({ id: row.id, activityId: row.activity_id, employeeName: row.employee_name, note: row.note_enc ? decrypt(row.note_enc, row.owner_id) : '', completedAt: row.completed_at, activityTitle: decrypt(row.title_enc, row.owner_id) }))
      const users = await pool.query('SELECT id, name, position, role FROM users WHERE is_active = TRUE ORDER BY name')
      assignees = users.rows
    }
    res.json({ activities: activities.rows.map(decryptActivity), announcements: announcements.rows, activityReports, assignees })
  } catch (error) { next(error) }
})

router.post('/activities', requireRole('jefe'), async (req, res, next) => {
  try {
    const parsed = activitySchema.safeParse(req.body)
    if (!parsed.success || new Date(parsed.data.endAt) <= new Date(parsed.data.startAt)) return res.status(400).json({ error: 'Datos de actividad inválidos' })
    const a = parsed.data; const targetIds = a.visibility === 'selected' ? [...new Set([a.assigneeId, ...a.selectedUserIds])] : []
    const assignee = await pool.query("SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND role = 'empleado'", [a.assigneeId])
    if (!assignee.rows[0]) return res.status(400).json({ error: 'El responsable debe ser un empleado activo' })
    if (a.visibility === 'selected') {
      const targetCheck = await pool.query('SELECT id FROM users WHERE is_active = TRUE AND id = ANY($1::uuid[])', [targetIds])
      if (targetCheck.rows.length !== targetIds.length) return res.status(400).json({ error: 'Selecciona calendarios activos' })
    }
    const activityId = crypto.randomUUID()
    const { rows } = await pool.query('INSERT INTO activities (id, owner_id, assigned_by, title_enc, description_enc, start_enc, end_enc, status, priority, calendar_visibility, calendar_targets) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, status, priority, created_at', [activityId, a.assigneeId, req.user.id, encrypt(a.title, a.assigneeId), encrypt(a.description, a.assigneeId), encrypt(a.startAt, a.assigneeId), encrypt(a.endAt, a.assigneeId), 'pendiente', a.priority, a.visibility, targetIds])
    await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'activity_assigned', req.ip, req.get('user-agent'), JSON.stringify({ activity_id: activityId, assignee_id: a.assigneeId, visibility: a.visibility })])
    res.status(201).json({ activity: rows[0] })
  } catch (error) { next(error) }
})

router.patch('/activities/:id/complete', async (req, res, next) => {
  try {
    const parsed = completionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Reporte inválido' })
    const activity = await pool.query('SELECT a.id, a.owner_id, a.status, a.title_enc, u.name AS employee_name, b.email_enc, b.id AS boss_id FROM activities a JOIN users u ON u.id = a.owner_id LEFT JOIN users b ON b.id = a.assigned_by AND b.role = \'jefe\' WHERE a.id = $1 AND a.owner_id = $2', [req.params.id, req.user.id])
    const row = activity.rows[0]; if (!row) return res.status(404).json({ error: 'Recurso no encontrado' })
    if (row.status === 'hecha') return res.json({ completed: true })
    const completedAt = new Date().toISOString(); const noteEnc = parsed.data.note ? encrypt(parsed.data.note, req.user.id) : null
    await pool.query('UPDATE activities SET status = \'hecha\', completed_at = $1, completion_note_enc = $2 WHERE id = $3 AND owner_id = $4', [completedAt, noteEnc, row.id, req.user.id])
    await pool.query('INSERT INTO activity_reports (activity_id, employee_id, note_enc, completed_at) VALUES ($1, $2, $3, $4)', [row.id, req.user.id, noteEnc, completedAt])
    try { if (row.email_enc && row.boss_id) await sendActivityCompletionNotification(decrypt(row.email_enc, row.boss_id), req.user.name, decrypt(row.title_enc, req.user.id)) } catch (mailError) { req.log?.warn({ err: mailError, activityId: row.id }, 'activity completion email unavailable') }
    res.json({ completed: true, completedAt })
  } catch (error) { next(error) }
})

module.exports = router
