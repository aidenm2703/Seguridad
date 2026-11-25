const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const session = require('express-session')
const PgSession = require('connect-pg-simple')(session)
const pinoHttp = require('pino-http')

const { pool } = require('./db')
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const workspaceRoutes = require('./routes/workspace')
const privateRoutes = require('./routes/private')
const companyRoutes = require('./routes/company')
const { requireAuth } = require('./middleware/auth')

function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 0)
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }))
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }))
  app.use(express.json({ limit: '32kb' }))
  app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] }))
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }))
  app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'development-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
  }))

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ status: 'ok' })
    } catch (error) {
      res.status(503).json({ status: 'unavailable' })
    }
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/users', requireAuth, userRoutes)
  app.use('/api/workspace', requireAuth, workspaceRoutes)
  app.use('/api/private', requireAuth, privateRoutes)
  app.use('/api/company', requireAuth, companyRoutes)
  app.use((_req, res) => res.status(404).json({ error: 'Recurso no encontrado' }))
  app.use((error, req, res, _next) => {
    req.log?.error({ err: error }, 'unhandled request error')
    res.status(error.statusCode || 500).json({ error: 'Ocurrió un error al procesar la solicitud' })
  })
  return app
}

module.exports = { createApp }
