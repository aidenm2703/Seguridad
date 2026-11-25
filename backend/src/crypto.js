const crypto = require('node:crypto')

function keyFromEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} no está configurada`)
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error(`${name} debe ser una llave base64 de 32 bytes`)
  return key
}

function encrypt(value, ownerId, keyName = 'PRIVATE_KEY') {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFromEnv(keyName), iv)
  cipher.setAAD(Buffer.from(String(ownerId)))
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`
}

function decrypt(payload, ownerId, keyName = 'PRIVATE_KEY') {
  const [ivText, tagText, dataText] = String(payload).split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromEnv(keyName), Buffer.from(ivText, 'base64'))
  decipher.setAAD(Buffer.from(String(ownerId)))
  decipher.setAuthTag(Buffer.from(tagText, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64')), decipher.final()]).toString('utf8')
}

function blindIndex(value) {
  return crypto.createHmac('sha256', keyFromEnv('BLIND_INDEX_KEY')).update(value.trim().toLowerCase()).digest('hex')
}

module.exports = { encrypt, decrypt, blindIndex }
