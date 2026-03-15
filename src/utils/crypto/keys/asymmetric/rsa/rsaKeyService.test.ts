import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rsaKeyService } from './rsaKeyService'
const { masterKeyService } = await import('../../../keys/symmetric/master')
import { mockUserKeyService, store } from '../../../testUtils'

vi.mock('../../../../supabase/userKeyService', async () => {
  const { mockUserKeyService } = await import('../../../testUtils')
  return mockUserKeyService
})

const PASSWORD = 'test-password-rsa'
const NEW_PASSWORD = 'new-password-rsa'

// helper that sets up RSA keys + a wrapped master key under the same password
async function prepareKeysWithMaster() {
  const rsaPair = await rsaKeyService.generateKeys()
  await rsaKeyService.storeKeys(rsaPair, PASSWORD)

  // generate a temporary master key and wrap it with the current public key
  const generatedMasterKey = await masterKeyService.generateKey()
  // use masterKeyService directly to persist the wrapped master key
  const wrappedMasterKey = await masterKeyService.wrapKey(generatedMasterKey, rsaPair.publicKey)
  await masterKeyService.storeKey(wrappedMasterKey)
}

beforeEach(() => {
  store.clear()
})

describe('generateKeys', () => {
  it('returns a CryptoKeyPair with public and private keys', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    expect(keyPair.publicKey.type).toBe('public')
    expect(keyPair.privateKey.type).toBe('private')
  })

  it('returns keys with correct algorithm and size', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    expect(keyPair.publicKey.algorithm).toMatchObject({
      name: 'RSA-OAEP',
      modulusLength: 4096,
    })
    expect(keyPair.privateKey.algorithm).toMatchObject({
      name: 'RSA-OAEP',
      modulusLength: 4096,
    })
  })

  it('produces different key pairs on two calls', async () => {
    const a = await rsaKeyService.generateKeys()
    const b = await rsaKeyService.generateKeys()
    const exportedA = await crypto.subtle.exportKey('spki', a.publicKey)
    const exportedB = await crypto.subtle.exportKey('spki', b.publicKey)
    expect(new Uint8Array(exportedA)).not.toEqual(new Uint8Array(exportedB))
  })
})

describe('storeKeys', () => {
  it('makes hasKeys return true after storing', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    expect(await rsaKeyService.hasKeys()).toBe(true)
  })
})

describe('hasKeys', () => {
  it('returns false when storage is empty', async () => {
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })

  it('returns true after a full key pair is stored', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    expect(await rsaKeyService.hasKeys()).toBe(true)
  })

  it('returns false when only the public key is present', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const { fromUint8Array } = await import('js-base64')
    await mockUserKeyService.setRsaPublicKey(fromUint8Array(new Uint8Array(spki)))
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })

  it('returns false when only the private key is present', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    const encryptedPrivate = await mockUserKeyService.getRsaPrivateKeyEncrypted()
    await mockUserKeyService.deleteUserKeysRow()
    await mockUserKeyService.setRsaPrivateKeyEncrypted(encryptedPrivate!)
    expect(await rsaKeyService.hasKeys()).toBe(false)
  })
})

describe('loadPublicKey', () => {
  it('returns a CryptoKey with type public and correct usages', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
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
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    const key = await rsaKeyService.loadPrivateKey(PASSWORD)
    expect(key.type).toBe('private')
    expect(key.usages).toContain('decrypt')
    expect(key.usages).toContain('unwrapKey')
  })

  it('throws when storage is empty', async () => {
    await expect(rsaKeyService.loadPrivateKey(PASSWORD)).rejects.toThrow()
  })

  it('throws when the wrong password is used', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    await expect(rsaKeyService.loadPrivateKey('wrong-password')).rejects.toThrow()
  })
})

describe('reEncryptPrivateKey', () => {
  it('changes the stored encrypted private key blob', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    const before = await mockUserKeyService.getRsaPrivateKeyEncrypted()
    await rsaKeyService.reEncryptPrivateKey(PASSWORD, NEW_PASSWORD)
    const after = await mockUserKeyService.getRsaPrivateKeyEncrypted()
    expect(after).not.toBe(before)
  })

  it('allows loading the private key with the new password', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    await rsaKeyService.reEncryptPrivateKey(PASSWORD, NEW_PASSWORD)
    const key = await rsaKeyService.loadPrivateKey(NEW_PASSWORD)
    expect(key.type).toBe('private')
  })

  it('rejects loading the private key with the old password after rotation', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    await rsaKeyService.reEncryptPrivateKey(PASSWORD, NEW_PASSWORD)
    await expect(rsaKeyService.loadPrivateKey(PASSWORD)).rejects.toThrow()
  })

  it('throws when no private key is in storage', async () => {
    await expect(rsaKeyService.reEncryptPrivateKey(PASSWORD, NEW_PASSWORD)).rejects.toThrow()
  })
})

describe('round-trip lifecycle', () => {
  it('full lifecycle: generate → store → load both keys', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)

    const publicKey = await rsaKeyService.loadPublicKey()
    const privateKey = await rsaKeyService.loadPrivateKey(PASSWORD)
    expect(publicKey.type).toBe('public')
    expect(privateKey.type).toBe('private')

    expect(await rsaKeyService.hasKeys()).toBe(true)
  })

  it('password rotation round-trip', async () => {
    const keyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(keyPair, PASSWORD)
    await rsaKeyService.reEncryptPrivateKey(PASSWORD, NEW_PASSWORD)

    const key = await rsaKeyService.loadPrivateKey(NEW_PASSWORD)
    expect(key.type).toBe('private')

    await expect(rsaKeyService.loadPrivateKey(PASSWORD)).rejects.toThrow()
  })
})

// tests for new rotateRsaKeys functionality

describe('rotateRsaKeys', () => {
  it('creates a new key pair and leaves master key intact', async () => {
    await prepareKeysWithMaster()

    const originalPublic = await mockUserKeyService.getRsaPublicKey()
    const originalWrapped = await mockUserKeyService.getWrappedMasterKey()
    const oldPrivate = await rsaKeyService.loadPrivateKey(PASSWORD)
    const originalUnwrapped = await masterKeyService.unwrapKey(originalWrapped!, oldPrivate)

    await rsaKeyService.rotateKeys(PASSWORD)

    expect(await rsaKeyService.hasKeys()).toBe(true)

    const newPublic = await mockUserKeyService.getRsaPublicKey()
    expect(newPublic).not.toBe(originalPublic)

    const newPrivate = await rsaKeyService.loadPrivateKey(PASSWORD)
    // wrapping using the new private key should yield a different blob
    const wrapped = await masterKeyService.loadKey()
    const unwrapped = await masterKeyService.unwrapKey(wrapped, newPrivate)

    expect(wrapped).not.toBe(originalWrapped)
    expect(unwrapped.type).toBe('secret')

    // unwrapped master key should not have changed (same underlying key)
    const originalUnwrappedRaw = await crypto.subtle.exportKey('raw', originalUnwrapped)
    const unwrappedRaw = await crypto.subtle.exportKey('raw', unwrapped)
    expect(new Uint8Array(originalUnwrappedRaw)).toEqual(new Uint8Array(unwrappedRaw))
  })

  it('rolls back storage when re-wrapping fails', async () => {
    await prepareKeysWithMaster()
    const originalPub = await mockUserKeyService.getRsaPublicKey()
    const originalPriv = await mockUserKeyService.getRsaPrivateKeyEncrypted()
    const originalWrapped = await mockUserKeyService.getWrappedMasterKey()

    const spy = vi.spyOn(masterKeyService, 'wrapKey').mockImplementation(() => {
      throw new Error('simulated failure')
    })

    await expect(rsaKeyService.rotateKeys(PASSWORD)).rejects.toThrow(/RSA key rotation failed/)

    expect(await mockUserKeyService.getRsaPublicKey()).toBe(originalPub)
    expect(await mockUserKeyService.getRsaPrivateKeyEncrypted()).toBe(originalPriv)
    expect(await mockUserKeyService.getWrappedMasterKey()).toBe(originalWrapped)

    spy.mockRestore()
  })
})
