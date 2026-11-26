const nodemailer = require('nodemailer')

let transporter
function getTransporter() {
  if (transporter) return transporter
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null
  const secure = process.env.SMTP_SECURE === 'true'
  transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure, requireTLS: !secure, tls: { minVersion: 'TLSv1.2' }, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })
  return transporter
}

async function sendPasswordReset(email, token) {
  const currentTransporter = getTransporter()
  if (!currentTransporter) return false
  const url = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(token)}`
  await currentTransporter.sendMail({ from: process.env.SMTP_FROM, to: email, subject: 'Recuperación de acceso · SecureVault Corp', text: `Solicitaste recuperar tu acceso. Usa este enlace, válido durante 15 minutos: ${url}` })
  return true
}

async function sendMessageNotification(email, senderName) {
  const currentTransporter = getTransporter()
  if (!currentTransporter) return false
  const url = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/#mensajes`
  await currentTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Tienes un mensaje nuevo · SecureVault Corp',
    text: `${senderName} te envió un mensaje seguro. Ingresa a SecureVault para leerlo: ${url}`,
  })
  return true
}

module.exports = { sendPasswordReset, sendMessageNotification }
