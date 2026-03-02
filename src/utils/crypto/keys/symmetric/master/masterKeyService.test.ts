import { describe, it, expect, beforeEach, vi } from 'vitest'
import { masterKeyService, WRAPPED_MASTER_KEY_NAME } from './masterKeyService'
import { store } from '../../../testUtils'

vi.mock('../../../keyStorage', async () => {
  const { mockCryptoKeyStorage } = await import('../../../testUtils')
  return { cryptoKeyStorage: mockCryptoKeyStorage }
})

async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  )
}

beforeEach(() => {
  store.clear()
})

describe('generateKey', () => {
  it('returns a CryptoKey with type secret', async () => {
    const key = await masterKeyService.generateKey()
    expect(key.type).toBe('secret')
  })

  it('returns a key with encrypt and decrypt usages', async () => {
    const key = await masterKeyService.generateKey()
    expect(key.usages).toContain('encrypt')
    expect(key.usages).toContain('decrypt')
  })

  it('returns an AES-GCM 256-bit key', async () => {
    const key = await masterKeyService.generateKey()
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
  })

  it('produces different keys on two calls', async () => {
    const { publicKey } = await generateRsaKeyPair()

    const keyA = await masterKeyService.generateKey()
    const keyB = await masterKeyService.generateKey()

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode('test')

    const ciphertextA = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyA, plaintext)
    const ciphertextB = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyB, plaintext)

    expect(new Uint8Array(ciphertextA)).not.toEqual(new Uint8Array(ciphertextB))

    void publicKey
  })
})

describe('storeKey', () => {
  it('makes hasKey return true after storing', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    expect(await masterKeyService.hasKey()).toBe(true)
  })

  it('stores the value under the expected storage key', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    expect(store.has(WRAPPED_MASTER_KEY_NAME)).toBe(true)
  })

  it('overwrites an existing wrapped key', async () => {
    const { publicKey } = await generateRsaKeyPair()

    const first = await masterKeyService.generateKey()
    await masterKeyService.storeKey(first, publicKey)
    const storedFirst = store.get(WRAPPED_MASTER_KEY_NAME)

    const second = await masterKeyService.generateKey()
    await masterKeyService.storeKey(second, publicKey)
    const storedSecond = store.get(WRAPPED_MASTER_KEY_NAME)

    expect(storedFirst).not.toBe(storedSecond)
  })
})

describe('hasKey', () => {
  it('returns false when storage is empty', async () => {
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('returns true after a wrapped key is stored', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    expect(await masterKeyService.hasKey()).toBe(true)
  })
})

describe('loadKey', () => {
  it('returns a CryptoKey with type secret and correct usages', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)
    expect(loaded.type).toBe('secret')
    expect(loaded.usages).toContain('encrypt')
    expect(loaded.usages).toContain('decrypt')
  })

  it('throws when no key exists in storage', async () => {
    const { privateKey } = await generateRsaKeyPair()
    await expect(masterKeyService.loadKey(privateKey)).rejects.toThrow()
  })

  it('throws when the wrong private key is used', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const { privateKey: wrongPrivateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    await expect(masterKeyService.loadKey(wrongPrivateKey)).rejects.toThrow()
  })
})

describe('deleteKey', () => {
  it('makes hasKey return false after deleting', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    await masterKeyService.deleteKey()
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('makes loadKey throw after deleting', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    await masterKeyService.deleteKey()
    await expect(masterKeyService.loadKey(privateKey)).rejects.toThrow()
  })
})

describe('isEncrypted', () => {
  it('returns false for empty string', () => {
    expect(masterKeyService.isEncrypted('')).toBe(false)
  })

  it('returns false for invalid base64', () => {
    expect(masterKeyService.isEncrypted('not valid base64!@#$')).toBe(false)
  })

  it('returns false for too-short blob', () => {
    expect(masterKeyService.isEncrypted('YQ==')).toBe(false)
  })

  it('returns true for a real encrypted blob', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const encrypted = await masterKeyService.encrypt('test', loaded, 'aad')
    expect(masterKeyService.isEncrypted(encrypted)).toBe(true)
  })
})

describe('encrypt', () => {
  it('returns a non-empty base64 string', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const result = await masterKeyService.encrypt('plaintext', loaded, 'aad')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different ciphertexts for same plaintext (random IV)', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const a = await masterKeyService.encrypt('same', loaded, 'aad')
    const b = await masterKeyService.encrypt('same', loaded, 'aad')
    expect(a).not.toBe(b)
  })
})

describe('decrypt', () => {
  it('round-trip: encrypt then decrypt returns original plaintext', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const original = 'hello world'
    const aad = 'user:field'
    const encrypted = await masterKeyService.encrypt(original, loaded, aad)
    const decrypted = await masterKeyService.decrypt(encrypted, loaded, aad)

    expect(decrypted).toBe(original)
  })

  it('throws when decrypting with wrong key', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const wrongKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

    const encrypted = await masterKeyService.encrypt('test', loaded, 'aad')
    await expect(masterKeyService.decrypt(encrypted, wrongKey, 'aad')).rejects.toThrow()
  })

  it('throws when AAD does not match', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const encrypted = await masterKeyService.encrypt('test', loaded, 'correct-aad')
    await expect(masterKeyService.decrypt(encrypted, loaded, 'wrong-aad')).rejects.toThrow()
  })

  it('throws for corrupted blob', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const corrupted = 'AAAAAAAAAAAAAAAA'
    await expect(masterKeyService.decrypt(corrupted, loaded, 'aad')).rejects.toThrow()
  })
})

describe('round-trip lifecycle', () => {
  it('full lifecycle: generate → store → load → delete', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)

    expect(await masterKeyService.hasKey()).toBe(true)

    const loaded = await masterKeyService.loadKey(privateKey)

    expect(loaded.type).toBe('secret')
    expect(loaded.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })

    await masterKeyService.deleteKey()
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('loaded key can encrypt and decrypt data', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)
    const loaded = await masterKeyService.loadKey(privateKey)

    const plaintext = new TextEncoder().encode('hello master key')
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, loaded, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, loaded, ciphertext)

    expect(new TextDecoder().decode(decrypted)).toBe('hello master key')
  })

  it('two separate loads from the same stored key produce equivalent keys', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, publicKey)

    const key1 = await masterKeyService.loadKey(privateKey)
    const key2 = await masterKeyService.loadKey(privateKey)

    const plaintext = new TextEncoder().encode('consistency check')
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ciphertext)

    expect(new TextDecoder().decode(decrypted)).toBe('consistency check')
  })
})
