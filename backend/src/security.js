const crypto = require('node:crypto')

function passwordSchema(z) {
  return z.string().min(12).max(128)
    .regex(/[a-z]/, 'Debe contener una letra minúscula')
    .regex(/[A-Z]/, 'Debe contener una letra mayúscula')
    .regex(/[0-9]/, 'Debe contener un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener un símbolo')
}

function ensureProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres en producción')
  if (!process.env.FRONTEND_ORIGIN?.startsWith('https://')) throw new Error('FRONTEND_ORIGIN debe usar HTTPS en producción')
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.path === '/api/auth/login' || req.path === '/api/auth/password-reset/request' || req.path === '/api/auth/password-reset/complete') return next()
  const token = req.get('x-csrf-token')
  const expected = req.session?.csrfToken
  if (!req.session?.user || !token || !expected || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.status(403).json({ error: 'Solicitud no autorizada' })
  next()
}

function issueCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('base64url')
  return req.session.csrfToken
}

module.exports = { passwordSchema, ensureProductionConfiguration, csrfProtection, issueCsrfToken }
