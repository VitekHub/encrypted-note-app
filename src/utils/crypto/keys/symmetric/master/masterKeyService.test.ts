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

async function loadMasterKey(rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
  const storedMasterKey = await masterKeyService.loadKey()
  const unwrappedMasterKey = await masterKeyService.unwrapKey(storedMasterKey, rsaPrivateKey)
  return await masterKeyService.convertToDerivable(unwrappedMasterKey)
}

async function storeMasterKey(masterKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<void> {
  const wrappedMasterKey = await masterKeyService.wrapKey(masterKey, rsaPublicKey)
  await masterKeyService.storeKey(wrappedMasterKey)
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
    await storeMasterKey(masterKey, publicKey)
    expect(await masterKeyService.hasKey()).toBe(true)
  })

  it('stores the value under the expected storage key', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await storeMasterKey(masterKey, publicKey)
    expect(store.has(WRAPPED_MASTER_KEY_NAME)).toBe(true)
  })

  it('overwrites an existing wrapped key', async () => {
    const { publicKey } = await generateRsaKeyPair()

    const first = await masterKeyService.generateKey()
    await storeMasterKey(first, publicKey)
    const storedFirst = store.get(WRAPPED_MASTER_KEY_NAME)

    const second = await masterKeyService.generateKey()
    await storeMasterKey(second, publicKey)
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
    await storeMasterKey(masterKey, publicKey)
    expect(await masterKeyService.hasKey()).toBe(true)
  })
})

describe('loadKey', () => {
  it('returns a CryptoKey with type secret and correct usages', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await storeMasterKey(masterKey, publicKey)
    const loaded = await loadMasterKey(privateKey)
    expect(loaded.type).toBe('secret')
    expect(loaded.usages).toContain('deriveKey')
    expect(loaded.usages).toContain('deriveBits')
  })

  it('throws when no key exists in storage', async () => {
    const { privateKey } = await generateRsaKeyPair()
    await expect(loadMasterKey(privateKey)).rejects.toThrow()
  })

  it('throws when the wrong private key is used', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const { privateKey: wrongPrivateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await storeMasterKey(masterKey, publicKey)
    await expect(loadMasterKey(wrongPrivateKey)).rejects.toThrow()
  })
})

describe('deleteKey', () => {
  it('makes hasKey return false after deleting', async () => {
    const { publicKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await storeMasterKey(masterKey, publicKey)
    await masterKeyService.deleteKey()
    expect(await masterKeyService.hasKey()).toBe(false)
  })

  it('makes loadKey throw after deleting', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()
    const masterKey = await masterKeyService.generateKey()
    await storeMasterKey(masterKey, publicKey)
    await masterKeyService.deleteKey()
    await expect(loadMasterKey(privateKey)).rejects.toThrow()
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
})

describe('round-trip lifecycle', () => {
  it('full lifecycle: generate → store → load → delete', async () => {
    const { publicKey, privateKey } = await generateRsaKeyPair()

    const masterKey = await masterKeyService.generateKey()
    await storeMasterKey(masterKey, publicKey)

    expect(await masterKeyService.hasKey()).toBe(true)

    const loaded = await loadMasterKey(privateKey)

    expect(loaded.type).toBe('secret')
    expect(loaded.algorithm).toMatchObject({ name: 'HKDF' })

    await masterKeyService.deleteKey()
    expect(await masterKeyService.hasKey()).toBe(false)
  })
})
