const test = require('node:test')
const assert = require('node:assert/strict')
const { z } = require('zod')
const { passwordSchema } = require('../src/security')

test('exige una contraseña con complejidad mínima', () => {
  const schema = passwordSchema(z)
  assert.equal(schema.safeParse('UnaClaveSegura2026!').success, true)
  assert.equal(schema.safeParse('solamente-minusculas').success, false)
  assert.equal(schema.safeParse('Corta1!').success, false)
})
