/**
 * This module provides simple encryption and decryption utilities using AES-GCM (Galois/Counter Mode)
 * with PBKDF2 (Password-Based Key Derivation Function 2) for key derivation from a password.
 * AES-GCM is a symmetric encryption algorithm that provides both confidentiality and authenticity.
 * PBKDF2 is used to derive a strong cryptographic key from a password, making brute-force attacks harder.
 */

import { fromUint8Array, toUint8Array } from 'js-base64'

/**
 * Number of iterations for PBKDF2 key derivation. Higher values increase security by making key derivation slower,
 * which protects against dictionary attacks, but also increases computation time for encryption/decryption.
 */
const ITERATIONS = 600_000
const SALT_LEN   = 16                    // 128‑bit salt
const IV_LEN     = 12                    // 96‑bit IV (recommended for GCM)
const MIN_BLOB_LEN = SALT_LEN + IV_LEN + 1 // at least 1 byte for ciphertext

/**
 * Concatenate multiple Uint8Arrays and return the result as a base64-encoded string.
 * This encodes the combined bytes into a base64 string suitable for storage or transmission.
 * @param {...Uint8Array} arrays - One or more Uint8Arrays to concatenate
 * @returns {string} A base64-encoded string of the concatenated bytes
 */
function concatToBase64(...arrays: Uint8Array[]): string {
  const totalLength = arrays.reduce((sum, a) => sum + a.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return fromUint8Array(result);
}

/**
 * Decodes a base64 string and validates it meets the minimum blob length.
 * Throws if the string is not valid base64 or is too short to be a valid encrypted blob.
 * @param {string} value - The base64 string to decode
 * @returns {Uint8Array} The decoded bytes
 */
function parseBlob(value: string): Uint8Array {
  const bytes = toUint8Array(value)
  if (bytes.length < MIN_BLOB_LEN) throw new Error('Invalid encrypted format')
  return bytes
}

/**
 * Encode a text string to an ArrayBuffer (UTF-8).
 * This is a small helper that wraps `TextEncoder` to produce a binary buffer
 * suitable for use as input to Web Crypto APIs.
 * @param {string} text - The text to encode
 * @returns {ArrayBuffer} The encoded text as an ArrayBuffer
 */
function textToBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

/**
 * Decode an ArrayBuffer (UTF-8) back to a string.
 * Wraps `TextDecoder` for convenience when converting decrypted bytes to text.
 * @param {ArrayBuffer} buffer - The buffer to decode
 * @returns {string} The decoded string
 */
function bufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * PBKDF2 stretches the password into a key suitable for AES-GCM encryption.
 * - Password is encoded to bytes.
 * - Key material is imported as raw bytes for PBKDF2.
 * - Derives a 256-bit AES-GCM key.
 * This function is asynchronous because key derivation involves cryptographic operations.
 * @param {string} password - The password string
 * @param {ArrayBuffer} salt - The salt ArrayBuffer
 * @returns {Promise<CryptoKey>} Promise resolving to the derived CryptoKey
 */
async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  // Encode the password string into UTF-8 bytes.
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textToBuffer(password),
    'PBKDF2',
    false, // Not extractable
    ['deriveKey'] // Allowed usages
  )
  // Derive the key using PBKDF2 with SHA-256 hash, specified iterations, and the provided salt.
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, // 256-bit AES key for GCM mode
    false, // Not extractable
    ['encrypt', 'decrypt'] // Allowed usages
  )
}

/**
 * Encrypts a plaintext string using a password.
 * Generates random salt and initialization vector (IV) for each encryption to ensure uniqueness.
 * Returns a Base64‑encoded blob that concatenates salt, IV and ciphertext.
 * This format allows the encrypted data to be stored as a string and later decrypted.
 * @param {string} plaintext - The text to encrypt
 * @param {string} password - The password for encryption
 * @param {string} aad - Additional authenticated data
 * @returns {Promise<string>} Promise resolving to the encrypted string
 */
export async function encryptField(plaintext: string, password: string, aad: string): Promise<string> {
  // Generate a random 16-byte salt for PBKDF2. Salt prevents rainbow table attacks.
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  // Generate a random 12-byte IV for AES-GCM. IV ensures that identical plaintexts encrypt differently.
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  // Derive the encryption key from password and salt.
  const key = await deriveKey(password, salt.buffer as ArrayBuffer)
  // Encrypt the plaintext using AES-GCM with the derived key and IV.
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: textToBuffer(aad), // AAD ensures integrity of associated data
    },
    key,
    textToBuffer(plaintext)
  );

  return concatToBase64(salt, iv, new Uint8Array(ciphertext));
}

/**
 * Decrypts an encrypted string back to plaintext using the password.
 * Expects the input to be a Base64‑encoded blob that concatenates
 * salt, IV and ciphertext (produced by encryptField).
 * Throws an error if the format is invalid or decryption fails (e.g., wrong password).
 * @param {string} encryptedBlob - The Base64‑encoded encrypted blob
 * @param {string} password - The password for decryption
 * @param {string} aad - Additional authenticated data (must match encryption)
 * @returns {Promise<string>} Promise resolving to the decrypted plaintext
 */
export async function decryptField(encryptedBlob: string, password: string, aad: string): Promise<string> {
  // Decode and validate the base64 blob
  const raw = parseBlob(encryptedBlob)
  // Slice the raw back to salt, iv and cipherText
  const salt       = raw.slice(0, SALT_LEN).buffer as ArrayBuffer
  const iv         = raw.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const ciphertext = raw.slice(SALT_LEN + IV_LEN)
  // Derive the decryption key using the same password and extracted salt.
  const key = await deriveKey(password, salt)
  // Decrypt the ciphertext using AES-GCM with the derived key and IV.
  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: textToBuffer(aad), // Must match encryption AAD
    },
    key,
    ciphertext
  )
  // Decode the decrypted bytes back to a string.
  return bufferToText(plainBuffer)
}

export function isEncrypted(value: string): boolean {
  if (!value) return false
  try {
    parseBlob(value)
    return true
  } catch {
    return false
  }
}
