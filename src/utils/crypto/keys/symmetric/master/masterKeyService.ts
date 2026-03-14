import { fromUint8Array, toUint8Array } from 'js-base64'
import { cryptoKeyStorage } from '../../../keyStorage'
import type { MasterKeyService } from './types'

/** Key name under which the wrapped master key is stored */
export const WRAPPED_MASTER_KEY_NAME = 'wrapped_master_key'

const MASTER_KEY_ALGORITHM = {
  name: 'AES-GCM',
  length: 256,
} as const

const RSA_WRAP_ALGORITHM = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
} as const

const ENCRYPTION_IV_LEN = 12
const MIN_ENCRYPTED_BLOB_LEN = ENCRYPTION_IV_LEN

/**
 * Singleton instance of MasterKeyService.
 *
 * Provides a centralized, consistent interface for all Master Key operations
 * throughout the application. This object groups related cryptographic functions
 * and manages the relationship between RSA public/private keys and the Master Key.
 *
 * @example
 * ```typescript
 * import { masterKeyService } from './masterKeyService';
 *
 * // Check if setup is complete
 * if (await masterKeyService.hasKey()) {
 *   // Load and unwrap during unlock flow
 *   const storedMasterKey = await masterKeyService.loadKey()
 *   const unwrappedMasterKey = await masterKeyService.unwrapKey(storedMasterKey, rsaPrivateKey)
 *   const masterKey = await masterKeyService.convertToDerivable(unwrappedMasterKey)
 * } else {
 *   // Generate during initial setup
 *   const newKey = await masterKeyService.generateKey();
 *   const wrappedMasterKey = await masterKeyService.wrapKey(newKey, rsaPublicKey)
 *   await masterKeyService.storeKey(wrappedMasterKey)
 * }
 * ```
 */
export const masterKeyService: MasterKeyService = {
  /** @inheritdoc */
  async generateKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        MASTER_KEY_ALGORITHM,
        true, // extractable so we can wrap it or convert it to derivable
        ['encrypt', 'decrypt']
      )
    } catch {
      throw new Error('Failed to generate master key')
    }
  },

  /** @inheritdoc */
  async wrapKey(unwrappedMasterKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<string> {
    try {
      const wrappedMasterKey = await crypto.subtle.wrapKey(
        'raw', // AES keys are exported as raw bytes
        unwrappedMasterKey,
        rsaPublicKey,
        RSA_WRAP_ALGORITHM
      )
      const wrappedMasterKeyBase64 = fromUint8Array(new Uint8Array(wrappedMasterKey))
      return wrappedMasterKeyBase64
    } catch {
      throw new Error('Failed to wrap master key')
    }
  },

  /** @inheritdoc */
  async storeKey(wrappedMasterKeyBase64: string): Promise<void> {
    await cryptoKeyStorage.set(WRAPPED_MASTER_KEY_NAME, wrappedMasterKeyBase64)
  },

  /** @inheritdoc */
  async loadKey(): Promise<string> {
    const wrappedMasterKey = await cryptoKeyStorage.get(WRAPPED_MASTER_KEY_NAME)
    if (!wrappedMasterKey) throw new Error('Wrapped Master key not found in storage')
    return wrappedMasterKey
  },

  /** @inheritdoc */
  async unwrapKey(wrappedMasterKey: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
    try {
      return crypto.subtle.unwrapKey(
        'raw',
        toUint8Array(wrappedMasterKey).buffer as ArrayBuffer,
        rsaPrivateKey,
        RSA_WRAP_ALGORITHM,
        MASTER_KEY_ALGORITHM,
        true, // extractable (for future re-wrapping if needed)
        ['encrypt', 'decrypt']
      )
    } catch {
      throw new Error('Failed to unwrap master key. Private key may be incorrect.')
    }
  },

  /** @inheritdoc */
  async convertToDerivable(unwrappedMasterKey: CryptoKey): Promise<CryptoKey> {
    // Make the key derivable
    const raw = await crypto.subtle.exportKey('raw', unwrappedMasterKey)
    return crypto.subtle.importKey(
      'raw',
      raw,
      {
        name: 'HKDF',
        hash: 'SHA-256',
      }, // algorithm for the imported key
      false, // non-extractable
      ['deriveKey', 'deriveBits'] // allow derivation
    )
  },

  /** @inheritdoc */
  async hasKey(): Promise<boolean> {
    return cryptoKeyStorage.has(WRAPPED_MASTER_KEY_NAME)
  },

  /** @inheritdoc */
  async deleteKey(): Promise<void> {
    await cryptoKeyStorage.delete(WRAPPED_MASTER_KEY_NAME)
  },

  /** @inheritdoc */
  isEncrypted(blob: string): boolean {
    try {
      if (!blob || blob.length === 0) return false
      const raw = toUint8Array(blob)
      return raw.length >= MIN_ENCRYPTED_BLOB_LEN
    } catch {
      return false
    }
  },
}
