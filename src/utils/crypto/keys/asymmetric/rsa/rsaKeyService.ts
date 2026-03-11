import { fromUint8Array, toUint8Array } from 'js-base64'
import { passwordDerivedService } from '../../../keys/symmetric/passwordDerived'
import { masterKeyService } from '../../../keys/symmetric/master'
import { cryptoKeyStorage } from '../../../keyStorage'
import type { RsaKeyService } from './types'
import type { Argon2Params } from '../../../argon2Calibration/types'

/** Key name under which the RSA public key (SPKI format, base64) is stored */
const RSA_PUBLIC_KEY_NAME = 'rsa_public_key_spki'

/** Key name under which the encrypted RSA private key is stored */
const RSA_PRIVATE_KEY_ENCRYPTED_NAME = 'rsa_private_key_encrypted'

/** Key name under which the RSA key version is stored */
const RSA_KEY_VERSION_NAME = 'rsa_key_version'

/** AAD used when encrypting the RSA private key with encryptField() */
const RSA_PRIVATE_KEY_AAD = 'rsa_private_key_wrapper_v1'

/** Current RSA key version */
const RSA_KEY_VERSION = 'rsa_v1'

/** RSA-OAEP algorithm configuration (2048-bit recommended for key wrapping) */
const RSA_ALGORITHM = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537 (Fermat prime F₄) - prime, only two '1' bits → very fast modular exponentiation, resistant to low-exponent attacks
  hash: 'SHA-256' as const,
} as const

export const rsaKeyService: RsaKeyService = {
  /** @inheritdoc */
  async generateKeys(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      RSA_ALGORITHM,
      true, // extractable only temporarily
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    )
  },

  /** @inheritdoc */
  async storeKeys(keyPair: CryptoKeyPair, password: string): Promise<void> {
    // 1. Export keys to base64
    const exportedPublicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const exportedPrivateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    const publicKeyBase64 = fromUint8Array(new Uint8Array(exportedPublicKey))
    const privateKeyBase64 = fromUint8Array(new Uint8Array(exportedPrivateKey))

    // 2. Encrypt private key using passwordDerivedService
    const encryptedPrivateKey = await passwordDerivedService.encrypt(privateKeyBase64, password, RSA_PRIVATE_KEY_AAD)

    // 3. Store both keys
    await Promise.all([
      cryptoKeyStorage.set(RSA_PUBLIC_KEY_NAME, publicKeyBase64),
      cryptoKeyStorage.set(RSA_PRIVATE_KEY_ENCRYPTED_NAME, encryptedPrivateKey),
      cryptoKeyStorage.set(RSA_KEY_VERSION_NAME, RSA_KEY_VERSION),
    ])
  },

  /** @inheritdoc */
  async loadPublicKey(): Promise<CryptoKey> {
    const stored = await cryptoKeyStorage.get(RSA_PUBLIC_KEY_NAME)
    if (!stored) throw new Error('RSA public key not found in storage')

    return crypto.subtle.importKey(
      'spki',
      toUint8Array(stored).buffer as ArrayBuffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt', 'wrapKey']
    )
  },

  /** @inheritdoc */
  async loadPrivateKey(password: string): Promise<CryptoKey> {
    const stored = await cryptoKeyStorage.get(RSA_PRIVATE_KEY_ENCRYPTED_NAME)
    if (!stored) throw new Error('RSA private key not found in storage')

    const privateKeyBase64 = await passwordDerivedService.decrypt(stored, password, RSA_PRIVATE_KEY_AAD)

    return crypto.subtle.importKey(
      'pkcs8',
      toUint8Array(privateKeyBase64).buffer as ArrayBuffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt', 'unwrapKey']
    )
  },

  /** @inheritdoc */
  async hasKeys(): Promise<boolean> {
    const [hasPublic, hasPrivate] = await Promise.all([
      cryptoKeyStorage.has(RSA_PUBLIC_KEY_NAME),
      cryptoKeyStorage.has(RSA_PRIVATE_KEY_ENCRYPTED_NAME),
    ])
    return hasPublic && hasPrivate
  },

  /** @inheritdoc */
  async deleteKeys(): Promise<void> {
    await Promise.all([
      cryptoKeyStorage.delete(RSA_PUBLIC_KEY_NAME),
      cryptoKeyStorage.delete(RSA_PRIVATE_KEY_ENCRYPTED_NAME),
    ])
  },

  /** @inheritdoc */
  async reEncryptPrivateKey(oldPassword: string, newPassword: string, newParams?: Argon2Params): Promise<void> {
    const stored = await cryptoKeyStorage.get(RSA_PRIVATE_KEY_ENCRYPTED_NAME)
    if (!stored) throw new Error('RSA private key not found in storage')

    // Decrypt with the default singleton (reads params from blob metadata)
    const privateKeyBase64 = await passwordDerivedService.decrypt(stored, oldPassword, RSA_PRIVATE_KEY_AAD)

    if (newParams) {
      passwordDerivedService.setParams(newParams)
    }
    // Re-encrypt with currently active params for a stronger wrapper
    const reEncrypted = await passwordDerivedService.encrypt(privateKeyBase64, newPassword, RSA_PRIVATE_KEY_AAD)

    await cryptoKeyStorage.set(RSA_PRIVATE_KEY_ENCRYPTED_NAME, reEncrypted)
  },

  /** @inheritdoc */
  async rotateKeys(password: string): Promise<void> {
    // Backup old keys
    const oldEncryptedPrivate = await cryptoKeyStorage.get(RSA_PRIVATE_KEY_ENCRYPTED_NAME)
    const oldPublic = await cryptoKeyStorage.get(RSA_PUBLIC_KEY_NAME)
    const oldWrappedMaster = await masterKeyService.loadKey()

    if (!oldEncryptedPrivate || !oldPublic || !oldWrappedMaster) {
      throw new Error('Missing old keys for rotation')
    }

    try {
      const oldPrivateKey = await rsaKeyService.loadPrivateKey(password)
      const oldMasterKey = await masterKeyService.unwrapKey(oldWrappedMaster, oldPrivateKey)
      const newKeyPair = await rsaKeyService.generateKeys()

      // Re-wrap master key with new public key and store keys
      const newWrappedMasterKey = await masterKeyService.wrapKey(oldMasterKey, newKeyPair.publicKey)
      await masterKeyService.storeKey(newWrappedMasterKey)
      await rsaKeyService.storeKeys(newKeyPair, password)

      // Test: load new private key and unwrap master key
      const newPrivateKey = await rsaKeyService.loadPrivateKey(password)
      const loadedKey = await masterKeyService.loadKey()
      await masterKeyService.unwrapKey(loadedKey, newPrivateKey) // Test unwrap

      // Success: delete backups (not needed since we overwrote)
      // But to be safe, we can clear any temp if added
    } catch (error) {
      // Rollback: restore old keys
      await cryptoKeyStorage.set(RSA_PRIVATE_KEY_ENCRYPTED_NAME, oldEncryptedPrivate)
      await cryptoKeyStorage.set(RSA_PUBLIC_KEY_NAME, oldPublic)
      await masterKeyService.storeKey(oldWrappedMaster)
      throw new Error(
        `RSA key rotation failed: ${error instanceof Error && error.message ? error.message : 'Unknown error'}`
      )
    }
  },
}
