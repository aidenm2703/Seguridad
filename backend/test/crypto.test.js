const test = require('node:test')
const assert = require('node:assert/strict')

process.env.PRIVATE_KEY = Buffer.alloc(32, 1).toString('base64')
process.env.CONFIDENTIAL_KEY = Buffer.alloc(32, 2).toString('base64')
process.env.MESSAGE_KEY = Buffer.alloc(32, 4).toString('base64')
process.env.BLIND_INDEX_KEY = Buffer.alloc(32, 3).toString('base64')
const { encrypt, decrypt, blindIndex } = require('../src/crypto')

test('cifra y descifra datos con AES-256-GCM y AAD del propietario', () => {
  const payload = encrypt('dirección privada', 'owner-1')
  assert.notEqual(payload, 'dirección privada')
  assert.equal(decrypt(payload, 'owner-1'), 'dirección privada')
  assert.throws(() => decrypt(payload, 'owner-2'))
})

test('blind index normaliza el correo sin revelar su valor', () => {
  const first = blindIndex(' PERSONA@EMPRESA.COM ')
  const second = blindIndex('persona@empresa.com')
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, 'persona@empresa.com')
})

test('los mensajes usan una llave separada y AAD estable por mensaje', () => {
  const payload = encrypt('mensaje interno', 'message-1', 'MESSAGE_KEY')
  assert.equal(decrypt(payload, 'message-1', 'MESSAGE_KEY'), 'mensaje interno')
  assert.throws(() => decrypt(payload, 'message-2', 'MESSAGE_KEY'))
  assert.throws(() => decrypt(payload, 'message-1', 'PRIVATE_KEY'))
})
