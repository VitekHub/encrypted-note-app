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
 *   const masterKey = await masterKeyService.loadKey(rsaPrivateKey);
 * } else {
 *   // Generate during initial setup
 *   const newKey = await masterKeyService.generateKey();
 *   await masterKeyService.storeKey(newKey, rsaPublicKey);
 * }
 * ```
 */
export const masterKeyService: MasterKeyService = {
  /** @inheritdoc */
  async generateKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        MASTER_KEY_ALGORITHM,
        true, // extractable so we can wrap it
        ['encrypt', 'decrypt']
      )
    } catch {
      throw new Error('Failed to generate master key')
    }
  },

  /** @inheritdoc */
  async storeKey(generatedMasterKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<void> {
    try {
      const wrappedMasterKey = await crypto.subtle.wrapKey(
        'raw', // AES keys are exported as raw bytes
        generatedMasterKey,
        rsaPublicKey,
        RSA_WRAP_ALGORITHM
      )
      const wrappedMasterKeyBase64 = fromUint8Array(new Uint8Array(wrappedMasterKey))
      await cryptoKeyStorage.set(WRAPPED_MASTER_KEY_NAME, wrappedMasterKeyBase64)
    } catch {
      throw new Error('Failed to save master key')
    }
  },

  /** @inheritdoc */
  async loadKey(rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
    const stored = await cryptoKeyStorage.get(WRAPPED_MASTER_KEY_NAME)
    if (!stored) throw new Error('Wrapped Master key not found in storage')
    const wrappedMasterKey = toUint8Array(stored).buffer as ArrayBuffer

    try {
      return await crypto.subtle.unwrapKey(
        'raw',
        wrappedMasterKey,
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
  async hasKey(): Promise<boolean> {
    return cryptoKeyStorage.has(WRAPPED_MASTER_KEY_NAME)
  },

  /** @inheritdoc */
  async deleteKey(): Promise<void> {
    await cryptoKeyStorage.delete(WRAPPED_MASTER_KEY_NAME)
  },

  /** @inheritdoc */
  async encrypt(plaintext: string, masterKey: CryptoKey, aad: string): Promise<string> {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LEN))
      const plaintextBuffer = new TextEncoder().encode(plaintext)
      const aadBuffer = new TextEncoder().encode(aad)

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aadBuffer },
        masterKey,
        plaintextBuffer
      )

      const result = new Uint8Array(iv.length + ciphertext.byteLength)
      result.set(iv, 0)
      result.set(new Uint8Array(ciphertext), iv.length)

      return fromUint8Array(result)
    } catch {
      throw new Error('Failed to encrypt with master key')
    }
  },

  /** @inheritdoc */
  async decrypt(encryptedBlob: string, masterKey: CryptoKey, aad: string): Promise<string> {
    try {
      const raw = toUint8Array(encryptedBlob)
      const iv = raw.slice(0, ENCRYPTION_IV_LEN)
      const ciphertext = raw.slice(ENCRYPTION_IV_LEN).buffer as ArrayBuffer
      const aadBuffer = new TextEncoder().encode(aad)

      const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: aadBuffer },
        masterKey,
        ciphertext
      )

      return new TextDecoder().decode(plainBuffer)
    } catch {
      throw new Error('Failed to decrypt with master key. Wrong key or corrupted data.')
    }
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
