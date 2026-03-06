import { describe, it, expect } from 'vitest'
import { fieldKeyService } from './fieldKeyService'

const AAD = 'user123:note'
const PLAINTEXT = 'Field secret data'
const FIELD = 'note'

const generatedmasterKey = await crypto.subtle.generateKey(
  {
    name: 'AES-GCM',
    length: 256,
  },
  true, // extractable so we can wrap it or convert it to derivable
  ['encrypt', 'decrypt']
)

const raw = await crypto.subtle.exportKey('raw', generatedmasterKey)
const masterKey = await crypto.subtle.importKey(
  'raw',
  raw,
  {
    name: 'HKDF',
    hash: 'SHA-256',
  }, // algorithm for the imported key
  false, // non-extractable
  ['deriveKey', 'deriveBits'] // allow derivation
)

describe('fieldKeyService.encrypt', () => {
  it('produces a non-empty base64 string', async () => {
    const result = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different ciphertext on each call', async () => {
    const a = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    const b = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    expect(a).not.toBe(b)
  })
})

describe('fieldKeyService.decrypt (round-trip)', () => {
  it('round-trips plaintext', async () => {
    const blob = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    const decrypted = await fieldKeyService.decrypt(blob, masterKey, FIELD, AAD)
    expect(decrypted).toBe(PLAINTEXT)
  })

  it('throws if wrong fieldId', async () => {
    const blob = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    await expect(fieldKeyService.decrypt(blob, masterKey, 'other', AAD)).rejects.toThrow()
  })

  it('throws if wrong aad', async () => {
    const blob = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    await expect(fieldKeyService.decrypt(blob, masterKey, FIELD, 'bad')).rejects.toThrow()
  })

  it('throws if blob is tampered', async () => {
    const blob = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    const tampered = blob.slice(0, -4) + 'AAAA'
    await expect(fieldKeyService.decrypt(tampered, masterKey, FIELD, AAD)).rejects.toThrow()
  })

  it('throws on too-short blob', async () => {
    await expect(fieldKeyService.decrypt('short', masterKey, FIELD, AAD)).rejects.toThrow()
  })
})

describe('fieldKeyService.isEncrypted', () => {
  it('returns true for valid blob', async () => {
    const blob = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    expect(fieldKeyService.isEncrypted(blob)).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(fieldKeyService.isEncrypted('hello')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(fieldKeyService.isEncrypted('')).toBe(false)
  })

  it('returns false for short base64', () => {
    expect(fieldKeyService.isEncrypted('dG9vcw==')).toBe(false)
  })
})
