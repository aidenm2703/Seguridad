const router = require('express').Router()
const { z } = require('zod')
const { pool } = require('../db')
const { encrypt, decrypt } = require('../crypto')
const { requireRole } = require('../middleware/auth')

const reportSchema = z.object({ reportDate: z.string().date(), content: z.string().trim().min(1).max(5000) })
const paymentSchema = z.object({ employeeId: z.string().uuid(), amount: z.string().regex(/^\d+(\.\d{1,2})?$/), concept: z.string().trim().min(1).max(120), period: z.string().date() })

router.get('/reports', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, report_date, content_enc FROM daily_reports WHERE owner_id = $1 ORDER BY report_date DESC LIMIT 30', [req.user.id])
    res.json({ reports: rows.map((row) => ({ id: row.id, reportDate: row.report_date, content: decrypt(row.content_enc, req.user.id) })) })
  } catch (error) { next(error) }
})

router.post('/reports', async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Reporte inválido' })
    const { reportDate, content } = parsed.data
    const { rows } = await pool.query('INSERT INTO daily_reports (owner_id, report_date, content_enc) VALUES ($1, $2, $3) ON CONFLICT (owner_id, report_date) DO UPDATE SET content_enc = EXCLUDED.content_enc RETURNING id, report_date', [req.user.id, reportDate, encrypt(content, req.user.id)])
    res.status(201).json({ report: { id: rows[0].id, reportDate: rows[0].report_date } })
  } catch (error) { next(error) }
})

router.get('/payments', async (req, res, next) => {
  try {
    const isBoss = req.user.role === 'jefe'
    const query = isBoss ? 'SELECT id, employee_id, amount_enc, concept_enc, period FROM payments ORDER BY period DESC LIMIT 100' : 'SELECT id, employee_id, amount_enc, concept_enc, period FROM payments WHERE employee_id = $1 ORDER BY period DESC LIMIT 30'
    const { rows } = await pool.query(query, isBoss ? [] : [req.user.id])
    res.json({ payments: rows.map((row) => ({ id: row.id, employeeId: row.employee_id, amount: decrypt(row.amount_enc, row.employee_id, 'CONFIDENTIAL_KEY'), concept: decrypt(row.concept_enc, row.employee_id, 'CONFIDENTIAL_KEY'), period: row.period })) })
  } catch (error) { next(error) }
})

router.post('/payments', requireRole('jefe'), async (req, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Pago inválido' })
    const { employeeId, amount, concept, period } = parsed.data
    const employee = await pool.query("SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND role = 'empleado'", [employeeId])
    if (!employee.rows[0]) return res.status(400).json({ error: 'El pago debe pertenecer a un empleado activo' })
    const { rows } = await pool.query('INSERT INTO payments (employee_id, amount_enc, concept_enc, period) VALUES ($1, $2, $3, $4) RETURNING id, employee_id, period', [employeeId, encrypt(amount, employeeId, 'CONFIDENTIAL_KEY'), encrypt(concept, employeeId, 'CONFIDENTIAL_KEY'), period])
    await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'payment_created', req.ip, req.get('user-agent'), JSON.stringify({ employee_id: employeeId, payment_id: rows[0].id })])
    res.status(201).json({ payment: rows[0] })
  } catch (error) { next(error) }
})

router.get('/documents', requireRole('jefe'), async (_req, res, next) => {
  try { const { rows } = await pool.query('SELECT id, title_enc, content_enc, uploaded_by, created_at FROM documents ORDER BY created_at DESC'); res.json({ documents: rows.map((row) => ({ id: row.id, title: decrypt(row.title_enc, row.uploaded_by, 'CONFIDENTIAL_KEY'), content: decrypt(row.content_enc, row.uploaded_by, 'CONFIDENTIAL_KEY'), uploadedBy: row.uploaded_by, createdAt: row.created_at })) }) } catch (error) { next(error) }
})

router.get('/profile', async (req, res, next) => {
  try { const { rows } = await pool.query('SELECT id, name, role, phone_enc, address_enc, position FROM users WHERE id = $1', [req.user.id]); const profile = rows[0]; if (!profile) return res.status(404).json({ error: 'Recurso no encontrado' }); res.json({ profile: { id: profile.id, name: profile.name, role: profile.role, position: profile.position, phone: profile.phone_enc ? decrypt(profile.phone_enc, profile.id) : null, address: profile.address_enc ? decrypt(profile.address_enc, profile.id) : null } }) } catch (error) { next(error) }
})

module.exports = router
