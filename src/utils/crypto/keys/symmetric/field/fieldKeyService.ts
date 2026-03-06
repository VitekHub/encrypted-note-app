import { fromUint8Array, toUint8Array } from 'js-base64'
import type { FieldKeyService } from './types'

const HKDF_SALT_LEN = 16 // 128-bit
const IV_LEN = 12 // 96-bit for AES-GCM
const MIN_BLOB_LEN = HKDF_SALT_LEN + IV_LEN + 1 // at least 1 byte ciphertext

const fieldKeys = new Map<string, { key: CryptoKey; salt: Uint8Array<ArrayBuffer> }>()

function concatToBase64(...arrays: Uint8Array[]): string {
  const totalLength = arrays.reduce((sum, a) => sum + a.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.byteLength
  }
  return fromUint8Array(result)
}

function parseBlob(value: string): Uint8Array {
  const bytes = toUint8Array(value)
  if (bytes.length < MIN_BLOB_LEN) throw new Error('Invalid encrypted format')
  return bytes
}

function textToBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

function bufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer)
}

export async function deriveFieldKey(masterKey: CryptoKey, salt: Uint8Array, fieldId: string): Promise<CryptoKey> {
  // use fieldId as HKDF info
  const info = textToBuffer(fieldId)

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
  async encrypt(plaintext, masterKey, fieldId, aad) {
    let key: CryptoKey
    let salt: Uint8Array<ArrayBuffer>

    if (fieldKeys.has(fieldId)) {
      salt = fieldKeys.get(fieldId)!.salt
      key = fieldKeys.get(fieldId)!.key
    } else {
      // !!! TODO myNewEncryptionService.getRandomSalt()
      salt = crypto.getRandomValues(new Uint8Array(HKDF_SALT_LEN))
      key = await deriveFieldKey(masterKey, salt, fieldId)
      fieldKeys.set(fieldId, { key, salt })
    }

    // !!! TODO tady by stacilo neco jako:
    //    return myNewEncryptionService.encrypt(key, salt, plaintext)
    //     a to stejne i v passwordDerivcedService.ts
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: textToBuffer(aad),
      },
      key,
      textToBuffer(plaintext)
    )

    return concatToBase64(salt, iv, new Uint8Array(ciphertext))
  },

  async decrypt(encryptedBlob, masterKey, fieldId, aad) {
    // !!! TODO parseBlob muze rovnou vratit vsechny salt, iv, ciphertext
    const raw = parseBlob(encryptedBlob)
    const salt = raw.slice(0, HKDF_SALT_LEN)
    const iv = raw.slice(HKDF_SALT_LEN, HKDF_SALT_LEN + IV_LEN)
    const ciphertext = raw.slice(HKDF_SALT_LEN + IV_LEN)

    // !!! TODO toto se nezmeni
    const key = await deriveFieldKey(masterKey, salt, fieldId)

    // !!! TODO toto muze jit do myNewEncryptionService.decrypt(iv, ciphertext, key, aad)
    // !!! TODO a vsechny tri zmeny i do passwordDerivcedService.ts
    const plainBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: textToBuffer(aad),
      },
      key,
      ciphertext
    )

    return bufferToText(plainBuffer)
  },

  isEncrypted(value) {
    if (!value) return false
    try {
      parseBlob(value)
      return true
    } catch {
      return false
    }
  },
}
