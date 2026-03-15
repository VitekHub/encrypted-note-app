import { describe, it, expect, beforeAll } from 'vitest'
import { Encryptor } from './Encryptor'

let aesKey: CryptoKey
let aesKey2: CryptoKey

beforeAll(async () => {
  aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  aesKey2 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
})

describe('Encryptor', () => {
  describe('getRandomSalt', () => {
    it('returns a Uint8Array of the configured salt length', () => {
      const enc = new Encryptor({ saltLen: 16 })
      const salt = enc.getRandomSalt()
      expect(salt).toBeInstanceOf(Uint8Array)
      expect(salt.byteLength).toBe(16)
    })

    it('returns a different salt on each call', () => {
      const enc = new Encryptor()
      const s1 = enc.getRandomSalt()
      const s2 = enc.getRandomSalt()
      expect(s1).not.toEqual(s2)
    })

    it('respects custom saltLen', () => {
      const enc = new Encryptor({ saltLen: 32 })
      expect(enc.getRandomSalt().byteLength).toBe(32)
    })
  })

  describe('textToBuffer / bufferToText', () => {
    it('are inverse operations for ASCII text', () => {
      const enc = new Encryptor()
      const text = 'hello world'
      expect(enc.bufferToText(enc.textToBuffer(text))).toBe(text)
    })

    it('are inverse operations for Unicode text', () => {
      const enc = new Encryptor()
      const text = '你好世界 🔐'
      expect(enc.bufferToText(enc.textToBuffer(text))).toBe(text)
    })
  })

  describe('concatToBase64 / parseBlob', () => {
    it('round-trips salt + iv + ciphertext', () => {
      const enc = new Encryptor({ saltLen: 16, ivLen: 12 })
      const salt = new Uint8Array(16).fill(1)
      const iv = new Uint8Array(12).fill(2)
      const ct = new Uint8Array(32).fill(3)

      const blob = enc.concatToBase64(salt, iv, ct)
      const parsed = enc.parseBlob(blob)

      expect(parsed.salt).toEqual(salt)
      expect(parsed.iv).toEqual(iv)
      expect(parsed.ciphertext).toEqual(ct)
      expect(parsed.metadata).toBeNull()
    })

    it('round-trips with metadata', () => {
      const enc = new Encryptor({ saltLen: 16, ivLen: 12, metadataLen: 8 })
      const salt = new Uint8Array(16).fill(1)
      const meta = new Uint8Array(8).fill(9)
      const iv = new Uint8Array(12).fill(2)
      const ct = new Uint8Array(32).fill(3)

      const blob = enc.concatToBase64(salt, meta, iv, ct)
      const parsed = enc.parseBlob(blob)

      expect(parsed.salt).toEqual(salt)
      expect(parsed.metadata).toEqual(meta)
      expect(parsed.iv).toEqual(iv)
      expect(parsed.ciphertext).toEqual(ct)
    })

    it('throws when blob is too short', () => {
      const enc = new Encryptor({ saltLen: 16, ivLen: 12 })
      const tooShort = enc.concatToBase64(new Uint8Array(5))
      expect(() => enc.parseBlob(tooShort)).toThrow('Invalid encrypted format')
    })
  })

  describe('encrypt / decrypt', () => {
    it('round-trips plaintext', async () => {
      const enc = new Encryptor()
      const salt = enc.getRandomSalt()
      const plaintext = 'Secret message'
      const aad = 'context:v1'

      const blob = await enc.encrypt(plaintext, aesKey, salt, aad)
      const { salt: parsedSalt, iv, ciphertext } = enc.parseBlob(blob)
      const result = await enc.decrypt(ciphertext, aesKey, iv, aad)

      expect(result).toBe(plaintext)
      expect(parsedSalt).toEqual(salt)
    })

    it('round-trips Unicode plaintext', async () => {
      const enc = new Encryptor()
      const plaintext = '🔐 Secret: 你好!'
      const blob = await enc.encrypt(plaintext, aesKey, enc.getRandomSalt(), 'aad')
      const { iv, ciphertext } = enc.parseBlob(blob)
      expect(await enc.decrypt(ciphertext, aesKey, iv, 'aad')).toBe(plaintext)
    })

    it('produces different ciphertext on each call (random IV)', async () => {
      const enc = new Encryptor()
      const salt = enc.getRandomSalt()
      const blob1 = await enc.encrypt('hello', aesKey, salt, 'aad')
      const blob2 = await enc.encrypt('hello', aesKey, salt, 'aad')
      expect(blob1).not.toBe(blob2)
    })

    it('throws on decrypt with wrong AAD', async () => {
      const enc = new Encryptor()
      const salt = enc.getRandomSalt()
      const blob = await enc.encrypt('secret', aesKey, salt, 'correct-aad')
      const { iv, ciphertext } = enc.parseBlob(blob)
      await expect(enc.decrypt(ciphertext, aesKey, iv, 'wrong-aad')).rejects.toThrow()
    })

    it('throws on decrypt with wrong key', async () => {
      const enc = new Encryptor()
      const salt = enc.getRandomSalt()
      const blob = await enc.encrypt('secret', aesKey, salt, 'aad')
      const { iv, ciphertext } = enc.parseBlob(blob)
      await expect(enc.decrypt(ciphertext, aesKey2, iv, 'aad')).rejects.toThrow()
    })

    it('embeds and preserves metadata when metadataLen is set', async () => {
      const enc = new Encryptor({ metadataLen: 4 })
      const salt = enc.getRandomSalt()
      const meta = new Uint8Array([1, 2, 3, 4])
      const blob = await enc.encrypt('data', aesKey, salt, 'aad', meta)
      const parsed = enc.parseBlob(blob)
      expect(parsed.metadata).toEqual(meta)
    })
  })

  describe('isEncrypted', () => {
    it('returns true for a valid encrypted blob', async () => {
      const enc = new Encryptor()
      const blob = await enc.encrypt('test', aesKey, enc.getRandomSalt(), 'aad')
      expect(enc.isEncrypted(blob)).toBe(true)
    })

    it('returns false for an empty string', () => {
      const enc = new Encryptor()
      expect(enc.isEncrypted('')).toBe(false)
    })

    it('returns false for a blob that is too short', () => {
      const enc = new Encryptor({ saltLen: 16, ivLen: 12 })
      const tooShort = btoa('tiny')
      expect(enc.isEncrypted(tooShort)).toBe(false)
    })

    it('returns false for random non-base64 text', () => {
      const enc = new Encryptor()
      expect(enc.isEncrypted('not valid base64!!!')).toBe(false)
    })
  })
})
