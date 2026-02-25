import { describe, it, expect } from 'vitest'
import { encryptField, decryptField, isEncrypted } from './encryption'

const PASSWORD = 'test-password-123'
const AAD      = 'note-id-abc'
const PLAINTEXT = 'Hello, secret world!'

describe('encryptField', () => {
  it('produces a non-empty base64 string', async () => {
    const result = await encryptField(PLAINTEXT, PASSWORD, AAD)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different ciphertext on each call (random salt/IV)', async () => {
    const a = await encryptField(PLAINTEXT, PASSWORD, AAD)
    const b = await encryptField(PLAINTEXT, PASSWORD, AAD)
    expect(a).not.toBe(b)
  })

  it('can encrypt an empty string', async () => {
    const result = await encryptField('', PASSWORD, AAD)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('can encrypt a very long string', async () => {
    const long = 'x'.repeat(100_000)
    const result = await encryptField(long, PASSWORD, AAD)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('decryptField (round-trip)', () => {
  it('decrypts back to the original plaintext', async () => {
    const blob = await encryptField(PLAINTEXT, PASSWORD, AAD)
    const result = await decryptField(blob, PASSWORD, AAD)
    expect(result).toBe(PLAINTEXT)
  })

  it('round-trips an empty string', async () => {
    const blob = await encryptField('', PASSWORD, AAD)
    const result = await decryptField(blob, PASSWORD, AAD)
    expect(result).toBe('')
  })

  it('round-trips a very long string', async () => {
    const long = 'x'.repeat(100_000)
    const blob = await encryptField(long, PASSWORD, AAD)
    const result = await decryptField(blob, PASSWORD, AAD)
    expect(result).toBe(long)
  })

  it('throws when the wrong password is used', async () => {
    const blob = await encryptField(PLAINTEXT, PASSWORD, AAD)
    await expect(decryptField(blob, 'wrong-password', AAD)).rejects.toThrow()
  })

  it('throws when the AAD does not match', async () => {
    const blob = await encryptField(PLAINTEXT, PASSWORD, AAD)
    await expect(decryptField(blob, PASSWORD, 'wrong-aad')).rejects.toThrow()
  })

  it('throws when the ciphertext blob is tampered with', async () => {
    const blob = await encryptField(PLAINTEXT, PASSWORD, AAD)
    const tampered = blob.slice(0, -4) + 'AAAA'
    await expect(decryptField(tampered, PASSWORD, AAD)).rejects.toThrow()
  })

  it('throws when given a string that is too short to be a valid blob', async () => {
    await expect(decryptField('tooshort', PASSWORD, AAD)).rejects.toThrow()
  })
})

describe('isEncrypted', () => {
  it('returns true for a valid encrypted blob', async () => {
    const blob = await encryptField(PLAINTEXT, PASSWORD, AAD)
    expect(isEncrypted(blob)).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isEncrypted('hello world')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isEncrypted('')).toBe(false)
  })

  it('returns false for a short base64 string below minimum blob length', () => {
    expect(isEncrypted('dG9vc2hvcnQ=')).toBe(false)
  })
})
