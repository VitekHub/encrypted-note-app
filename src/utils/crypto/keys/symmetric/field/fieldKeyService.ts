import type { FieldKeyService } from './types'
import { Encryptor } from '../../../Encryptor'

const fieldKeys = new Map<string, { key: CryptoKey; salt: Uint8Array<ArrayBuffer> }>()

const encryptor = new Encryptor()

async function deriveFieldKey(masterKey: CryptoKey, salt: Uint8Array, fieldId: string): Promise<CryptoKey> {
  // use fieldId as HKDF info
  const info = encryptor.textToBuffer(fieldId)

  // derive a 256-bit AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info,
    },
    masterKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  )
}

export const fieldKeyService: FieldKeyService = {
  /** @inheritdoc */
  async encrypt(plaintext, masterKey, fieldId, aad) {
    let key: CryptoKey
    let salt: Uint8Array<ArrayBuffer>

    if (fieldKeys.has(fieldId)) {
      salt = fieldKeys.get(fieldId)!.salt
      key = fieldKeys.get(fieldId)!.key
    } else {
      salt = encryptor.getRandomSalt()
      key = await deriveFieldKey(masterKey, salt, fieldId)
      fieldKeys.set(fieldId, { key, salt })
    }

    return encryptor.encrypt(plaintext, key, salt, aad)
  },

  /** @inheritdoc */
  async decrypt(encryptedBlob, masterKey, fieldId, aad) {
    const { salt, iv, ciphertext } = encryptor.parseBlob(encryptedBlob)
    const key = await deriveFieldKey(masterKey, salt, fieldId)
    return encryptor.decrypt(ciphertext, key, iv, aad)
  },

  /** @inheritdoc */
  isEncrypted(value) {
    return encryptor.isEncrypted(value)
  },
}
