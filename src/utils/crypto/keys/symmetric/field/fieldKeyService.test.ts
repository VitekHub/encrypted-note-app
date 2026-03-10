import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { fieldKeyService } from './fieldKeyService'
import { masterKeyService } from '../master'
import { rsaKeyService } from '../../asymmetric/rsa'
import { store } from '../../../testUtils'

const AAD = 'user123:note'
const PLAINTEXT = 'Field secret data'
const FIELD = 'note'

vi.mock('../../../keyStorage', async () => {
  const { mockCryptoKeyStorage } = await import('../../../testUtils')
  return { cryptoKeyStorage: mockCryptoKeyStorage }
})

async function loadMasterKey(rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
  const storedMasterKey = await masterKeyService.loadKey()
  const unwrappedMasterKey = await masterKeyService.unwrapKey(storedMasterKey, rsaPrivateKey)
  return await masterKeyService.convertToDerivable(unwrappedMasterKey)
}

async function storeMasterKey(masterKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<void> {
  const wrappedMasterKey = await masterKeyService.wrapKey(masterKey, rsaPublicKey)
  await masterKeyService.storeKey(wrappedMasterKey)
}

let generatedMasterKey: CryptoKey
let masterKey: CryptoKey

beforeAll(async () => {
  generatedMasterKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable so we can wrap it or convert it to derivable
    ['encrypt', 'decrypt']
  )

  const raw = await crypto.subtle.exportKey('raw', generatedMasterKey)
  masterKey = await crypto.subtle.importKey(
    'raw',
    raw,
    {
      name: 'HKDF',
      hash: 'SHA-256',
    }, // algorithm for the imported key
    false, // non-extractable
    ['deriveKey', 'deriveBits'] // allow derivation
  )
})

beforeEach(() => {
  store.clear()
})

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

  it('two separate loads from the same stored key produce equivalent keys', async () => {
    const { publicKey, privateKey } = await rsaKeyService.generateKeys()
    await storeMasterKey(generatedMasterKey, publicKey)
    const masterKey1 = await loadMasterKey(privateKey)
    const masterKey2 = await loadMasterKey(privateKey)
    const plaintext2 = 'consistency check'
    const ciphertext = await fieldKeyService.encrypt(plaintext2, masterKey1, FIELD, AAD)
    const decrypted = await fieldKeyService.decrypt(ciphertext, masterKey2, FIELD, AAD)

    expect(decrypted).toBe('consistency check')
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

describe('fieldKeyService.clear', () => {
  it('clears the cached keys without breaking subsequent operations', async () => {
    // Encrypt once to cache the key
    const blob1 = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)

    // Clear the cache
    fieldKeyService.clear()

    // Encrypt again should work and derive a new key
    const blob2 = await fieldKeyService.encrypt(PLAINTEXT, masterKey, FIELD, AAD)
    expect(blob2).not.toBe(blob1)

    // Decrypting both should still work because deriveFieldKey is deterministic given the same salt in the blob
    const dec1 = await fieldKeyService.decrypt(blob1, masterKey, FIELD, AAD)
    const dec2 = await fieldKeyService.decrypt(blob2, masterKey, FIELD, AAD)

    expect(dec1).toBe(PLAINTEXT)
    expect(dec2).toBe(PLAINTEXT)
  })
})
