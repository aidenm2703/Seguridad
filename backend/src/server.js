require('dotenv').config()
const { createApp } = require('./app')

const port = Number(process.env.PORT || 3000)
const app = createApp()
const server = app.listen(port, () => console.log(`SecureVault API escuchando en el puerto ${port}`))

function shutdown(signal) {
  console.log(`${signal}: cerrando servidor`)
  server.close(() => process.exit(0))
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (error) => console.error('Unhandled rejection', error))
