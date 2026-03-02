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
  it('returns a non-empty base64 string', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    expect(typeof wrapped).toBe('string')
    expect(wrapped.length).toBeGreaterThan(0)
  })

  it('produces different wrapped keys on two calls with the same public key', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const a = await masterKeyService.generateKey(publicKey)
    const b = await masterKeyService.generateKey(publicKey)
    expect(a).not.toBe(b)
  })
})

describe('storeKey', () => {
  it('makes hasKey return true after storing', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    expect(await masterKeyService.hasKey()).toBe(true)
  })

  it('stores the value under the expected storage key', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    expect(store.has(WRAPPED_MASTER_KEY_NAME)).toBe(true)
  })

  it('overwrites an existing wrapped key', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const first = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(first)
    const second = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(second)
    expect(store.get(WRAPPED_MASTER_KEY_NAME)).toBe(second)
  })
})

describe('hasKey', () => {
  it('returns false when storage is empty', async () => {
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('returns true after a wrapped key is stored', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    expect(await masterKeyService.hasKey()).toBe(true)
  })
})

describe('loadKey', () => {
  it('returns an ArrayBuffer after a key is stored', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    const loaded = await masterKeyService.loadKey()
    expect(loaded).toBeInstanceOf(ArrayBuffer)
    expect(loaded.byteLength).toBeGreaterThan(0)
  })

  it('throws when no key exists in storage', async () => {
    await expect(masterKeyService.loadKey()).rejects.toThrow()
  })
})

describe('unwrapKey', () => {
  it('returns a CryptoKey with type secret and correct usages', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    const loaded = await masterKeyService.loadKey()
    const masterKey = await masterKeyService.unwrapKey(loaded, privateKey)
    expect(masterKey.type).toBe('secret')
    expect(masterKey.usages).toContain('encrypt')
    expect(masterKey.usages).toContain('decrypt')
  })

  it('throws when the wrong private key is used', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const { privateKey: wrongPrivateKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    const loaded = await masterKeyService.loadKey()
    await expect(masterKeyService.unwrapKey(loaded, wrongPrivateKey)).rejects.toThrow()
  })

  it('throws when given invalid wrapped key data', async () => {
    const { privateKey } = await generateRsaKeyPair()
    const invalid = new Uint8Array(32).fill(0xff).buffer
    await expect(masterKeyService.unwrapKey(invalid, privateKey)).rejects.toThrow()
  })
})

describe('deleteKey', () => {
  it('makes hasKey return false after deleting', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    await masterKeyService.deleteKey()
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('makes loadKey throw after deleting', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)
    await masterKeyService.deleteKey()
    await expect(masterKeyService.loadKey()).rejects.toThrow()
  })
})

describe('round-trip lifecycle', () => {
  it('full lifecycle: generate → store → load → unwrap → delete', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)

    expect(await masterKeyService.hasKey()).toBe(true)

    const loaded = await masterKeyService.loadKey()
    const masterKey = await masterKeyService.unwrapKey(loaded, privateKey)

    expect(masterKey.type).toBe('secret')
    expect(masterKey.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })

    await masterKeyService.deleteKey()
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('unwrapped key can encrypt and decrypt data', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)

    const loaded = await masterKeyService.loadKey()
    const masterKey = await masterKeyService.unwrapKey(loaded, privateKey)

    const plaintext = new TextEncoder().encode('hello master key')
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext)

    expect(new TextDecoder().decode(decrypted)).toBe('hello master key')
  })

  it('two separate unwraps from the same stored key produce equivalent keys', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const wrapped = await masterKeyService.generateKey(publicKey)
    await masterKeyService.storeKey(wrapped)

    const loaded1 = await masterKeyService.loadKey()
    const key1 = await masterKeyService.unwrapKey(loaded1, privateKey)

    const loaded2 = await masterKeyService.loadKey()
    const key2 = await masterKeyService.unwrapKey(loaded2, privateKey)

    const plaintext = new TextEncoder().encode('consistency check')
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ciphertext)

    expect(new TextDecoder().decode(decrypted)).toBe('consistency check')
  })
})
