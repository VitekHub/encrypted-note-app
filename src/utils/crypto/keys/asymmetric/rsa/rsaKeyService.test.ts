import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rsaKeyService } from './rsaKeyService'

const store = new Map<string, string>()

vi.mock('../../../keyStorage', () => ({
  cryptoKeyStorage: {
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: string) => { store.set(key, value); return Promise.resolve() },
    delete: (key: string) => { store.delete(key); return Promise.resolve() },
    has: (key: string) => Promise.resolve(store.has(key)),
  },
}))

const PASSWORD = 'test-password-rsa'
const NEW_PASSWORD = 'new-password-rsa'

beforeEach(() => {
  store.clear()
})

describe('generateKeys', () => {
  it('returns non-empty publicKeyBase64 and encryptedPrivateKey', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    expect(typeof keyPair.publicKeyBase64).toBe('string')
    expect(keyPair.publicKeyBase64.length).toBeGreaterThan(0)
    expect(typeof keyPair.encryptedPrivateKey).toBe('string')
    expect(keyPair.encryptedPrivateKey.length).toBeGreaterThan(0)
  })

  it('produces different encryptedPrivateKey on two calls with the same password', async () => {
    const a = await rsaKeyService.generateKeys(PASSWORD)
    const b = await rsaKeyService.generateKeys(PASSWORD)
    expect(a.encryptedPrivateKey).not.toBe(b.encryptedPrivateKey)
  })
})

describe('storeKeys', () => {
  it('makes hasKeys return true after storing', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    expect(await rsaKeyService.hasKeys()).toBe(true)
  })
})

describe('hasKeys', () => {
  it('returns false when storage is empty', async () => {
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })

  it('returns true after a full key pair is stored', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    expect(await rsaKeyService.hasKeys()).toBe(true)
  })

  it('returns false when only the public key is present', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    store.delete('rsa_private_key_encrypted')
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })

  it('returns false when only the private key is present', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    store.delete('rsa_public_key_spki')
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })
})

describe('loadPublicKey', () => {
  it('returns a CryptoKey with type public and correct usages', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    const key = await rsaKeyService.loadPublicKey()
    expect(key.type).toBe('public')
    expect(key.usages).toContain('encrypt')
    expect(key.usages).toContain('wrapKey')
  })

  it('throws when storage is empty', async () => {
    await expect(rsaKeyService.loadPublicKey()).rejects.toThrow()
  })
})

describe('loadPrivateKey', () => {
  it('returns a CryptoKey with type private and correct usages', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    const key = await rsaKeyService.loadPrivateKey(PASSWORD)
    expect(key.type).toBe('private')
    expect(key.usages).toContain('decrypt')
    expect(key.usages).toContain('unwrapKey')
  })

  it('throws when storage is empty', async () => {
    await expect(rsaKeyService.loadPrivateKey(PASSWORD)).rejects.toThrow()
  })

  it('throws when the wrong password is used', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    await expect(rsaKeyService.loadPrivateKey('wrong-password')).rejects.toThrow()
  })
})

describe('deleteKeys', () => {
  it('makes hasKeys return false after deleting', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    await rsaKeyService.deleteKeys()
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })
})

describe('updatePassword', () => {
  it('changes the stored encrypted private key blob', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    const before = store.get('rsa_private_key_encrypted')
    await rsaKeyService.updatePassword(PASSWORD, NEW_PASSWORD)
    const after = store.get('rsa_private_key_encrypted')
    expect(after).not.toBe(before)
  })

  it('allows loading the private key with the new password', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    await rsaKeyService.updatePassword(PASSWORD, NEW_PASSWORD)
    const key = await rsaKeyService.loadPrivateKey(NEW_PASSWORD)
    expect(key.type).toBe('private')
  })

  it('rejects loading the private key with the old password after rotation', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    await rsaKeyService.updatePassword(PASSWORD, NEW_PASSWORD)
    await expect(rsaKeyService.loadPrivateKey(PASSWORD)).rejects.toThrow()
  })

  it('throws when no private key is in storage', async () => {
    await expect(rsaKeyService.updatePassword(PASSWORD, NEW_PASSWORD)).rejects.toThrow()
  })
})

describe('round-trip lifecycle', () => {
  it('full lifecycle: generate → store → load both keys → delete', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)

    const publicKey = await rsaKeyService.loadPublicKey()
    const privateKey = await rsaKeyService.loadPrivateKey(PASSWORD)
    expect(publicKey.type).toBe('public')
    expect(privateKey.type).toBe('private')

    await rsaKeyService.deleteKeys()
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })

  it('password rotation round-trip', async () => {
    const keyPair = await rsaKeyService.generateKeys(PASSWORD)
    await rsaKeyService.storeKeys(keyPair)
    await rsaKeyService.updatePassword(PASSWORD, NEW_PASSWORD)

    const key = await rsaKeyService.loadPrivateKey(NEW_PASSWORD)
    expect(key.type).toBe('private')

    await expect(rsaKeyService.loadPrivateKey(PASSWORD)).rejects.toThrow()
  })
})
