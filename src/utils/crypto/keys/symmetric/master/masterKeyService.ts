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
 *   const wrapped = await masterKeyService.loadKey();
 *   const masterKey = await masterKeyService.unwrapKey(wrapped, rsaPrivateKey);
 * } else {
 *   // Generate during initial setup
 *   const newKey = await masterKeyService.generateKey(rsaPublicKey);
 *   await masterKeyService.storeKey(newKey);
 * }
 * ```
 */
export const masterKeyService: MasterKeyService = {
  /** @inheritdoc */
  async generateKey(rsaPublicKey: CryptoKey): Promise<string> {
    try {
      const generatedMasterKey = await crypto.subtle.generateKey(
        MASTER_KEY_ALGORITHM,
        true, // extractable so we can wrap it
        ['encrypt', 'decrypt']
      )
      const wrappedMasterKey = await crypto.subtle.wrapKey(
        'raw', // AES keys are exported as raw bytes
        generatedMasterKey,
        rsaPublicKey,
        RSA_WRAP_ALGORITHM
      )
      return fromUint8Array(new Uint8Array(wrappedMasterKey))
    } catch {
      throw new Error('Failed to generate master key')
    }
  },

  /** @inheritdoc */
  async unwrapKey(wrappedMasterKey: ArrayBuffer, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
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
  async storeKey(wrappedMasterKey: string): Promise<void> {
    try {
      await cryptoKeyStorage.set(WRAPPED_MASTER_KEY_NAME, wrappedMasterKey)
    } catch {
      throw new Error('Failed to save master key')
    }
  },

  /** @inheritdoc */
  async loadKey(): Promise<ArrayBuffer> {
    const stored = await cryptoKeyStorage.get(WRAPPED_MASTER_KEY_NAME)
    if (!stored) throw new Error('Wrapped Master key not found in storage')
    return toUint8Array(stored).buffer as ArrayBuffer
  },

  /** @inheritdoc */
  async hasKey(): Promise<boolean> {
    return cryptoKeyStorage.has(WRAPPED_MASTER_KEY_NAME)
  },

  /** @inheritdoc */
  async deleteKey(): Promise<void> {
    await cryptoKeyStorage.delete(WRAPPED_MASTER_KEY_NAME)
  },
}
