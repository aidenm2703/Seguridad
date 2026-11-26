const router = require('express').Router()
const crypto = require('node:crypto')
const { z } = require('zod')
const { pool } = require('../db')
const { decrypt, encrypt } = require('../crypto')
const { sendMessageNotification } = require('../mailer')

const messageSchema = z.object({
  recipientId: z.string().uuid(),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
})

router.get('/recipients', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, position, role FROM users WHERE is_active = TRUE AND id <> $1 ORDER BY name', [req.user.id])
    res.json({ recipients: rows })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    const folder = req.query.folder === 'sent' ? 'sent' : 'inbox'
    const column = folder === 'sent' ? 'm.sender_id' : 'm.recipient_id'
    const otherUser = folder === 'sent' ? 'recipient_id' : 'sender_id'
    const { rows } = await pool.query(`SELECT m.id, m.sender_id, m.recipient_id, m.subject_enc, m.body_enc, m.read_at, m.created_at, u.name AS other_name, u.position AS other_position FROM messages m JOIN users u ON u.id = m.${otherUser} WHERE ${column} = $1 ORDER BY m.created_at DESC LIMIT 100`, [req.user.id])
    res.json({ folder, messages: rows.map((row) => ({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id, subject: decrypt(row.subject_enc, row.id, 'MESSAGE_KEY'), body: decrypt(row.body_enc, row.id, 'MESSAGE_KEY'), readAt: row.read_at, createdAt: row.created_at, otherUser: { name: row.other_name, position: row.other_position } })) })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Mensaje inválido' })
    if (parsed.data.recipientId === req.user.id) return res.status(400).json({ error: 'No puedes enviarte un mensaje a ti mismo' })
    const recipientResult = await pool.query('SELECT id, email_enc, created_by, name FROM users WHERE id = $1 AND is_active = TRUE', [parsed.data.recipientId])
    const recipient = recipientResult.rows[0]
    if (!recipient) return res.status(404).json({ error: 'Destinatario no encontrado' })
    const messageId = crypto.randomUUID()
    const { rows } = await pool.query('INSERT INTO messages (id, sender_id, recipient_id, subject_enc, body_enc) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at', [messageId, req.user.id, recipient.id, encrypt(parsed.data.subject, messageId, 'MESSAGE_KEY'), encrypt(parsed.data.body, messageId, 'MESSAGE_KEY')])
    try {
      let recipientEmail
      try { recipientEmail = decrypt(recipient.email_enc, recipient.id) } catch (error) { recipientEmail = recipient.created_by ? decrypt(recipient.email_enc, recipient.created_by) : (() => { throw error })() }
      await sendMessageNotification(recipientEmail, req.user.name)
    } catch (mailError) {
      req.log?.warn({ err: mailError, messageId }, 'message email notification unavailable')
    }
    await pool.query('INSERT INTO security_events (user_id, event_type, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'message_sent', req.ip, req.get('user-agent'), JSON.stringify({ message_id: messageId, recipient_id: recipient.id })])
    res.status(201).json({ message: { id: rows[0].id, createdAt: rows[0].created_at } })
  } catch (error) { next(error) }
})

router.patch('/:id/read', async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE messages SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND recipient_id = $2 RETURNING id, read_at', [req.params.id, req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'Recurso no encontrado' })
    res.json({ message: rows[0] })
  } catch (error) { next(error) }
})

module.exports = router
