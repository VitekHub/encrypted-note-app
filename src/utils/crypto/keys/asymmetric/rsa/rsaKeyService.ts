import { fromUint8Array, toUint8Array } from 'js-base64'
import { encryptField, decryptField } from '../../../encryption'
import { cryptoKeyStorage } from '../../../keyStorage'
import type { RsaKeyPair, RsaKeyService } from './types'

/** Key name under which the RSA public key (SPKI format, base64) is stored */
const RSA_PUBLIC_KEY_NAME = 'rsa_public_key_spki'

/** Key name under which the encrypted RSA private key is stored */
const RSA_PRIVATE_KEY_ENCRYPTED_NAME = 'rsa_private_key_encrypted'

/** AAD used when encrypting the RSA private key with encryptField() */
const RSA_PRIVATE_KEY_AAD = 'rsa_private_key_wrapper_v1'

/** RSA-OAEP algorithm configuration (2048-bit recommended for key wrapping) */
const RSA_ALGORITHM = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537 (Fermat prime F₄) - prime, only two '1' bits → very fast modular exponentiation, resistant to low-exponent attacks
  hash: 'SHA-256' as const,
} as const

export const rsaKeyService: RsaKeyService = {
  /** @inheritdoc */
  async generateKeys(password: string): Promise<RsaKeyPair> {
    // 1. Generate RSA key pair
    const keyPair = await crypto.subtle.generateKey(
      RSA_ALGORITHM,
      true, // extractable only temporarily
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    )

    // 2. Export keys to base64
    const exportedPublicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const exportedPrivateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    const publicKeyBase64 = fromUint8Array(new Uint8Array(exportedPublicKey))
    const privateKeyBase64 = fromUint8Array(new Uint8Array(exportedPrivateKey))

    // 3. Encrypt private key using existing encryptField logic
    const encryptedPrivateKey = await encryptField(
      privateKeyBase64,
      password,
      RSA_PRIVATE_KEY_AAD
    )

    // 4. Return both keys
    return { publicKeyBase64, encryptedPrivateKey }
  },

  /** @inheritdoc */
  async storeKeys(keyPair: RsaKeyPair): Promise<void> {
    await Promise.all([
      cryptoKeyStorage.set(RSA_PUBLIC_KEY_NAME, keyPair.publicKeyBase64),
      cryptoKeyStorage.set(RSA_PRIVATE_KEY_ENCRYPTED_NAME, keyPair.encryptedPrivateKey),
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

    const privateKeyBase64 = await decryptField(stored, password, RSA_PRIVATE_KEY_AAD)

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
  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    const stored = await cryptoKeyStorage.get(RSA_PRIVATE_KEY_ENCRYPTED_NAME)
    if (!stored) throw new Error('RSA private key not found in storage')

    const privateKeyBase64 = await decryptField(stored, oldPassword, RSA_PRIVATE_KEY_AAD)
    const reEncrypted = await encryptField(privateKeyBase64, newPassword, RSA_PRIVATE_KEY_AAD)

    await cryptoKeyStorage.set(RSA_PRIVATE_KEY_ENCRYPTED_NAME, reEncrypted)
  },
}
