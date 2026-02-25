/**
 * This module provides simple encryption and decryption utilities using AES-GCM (Galois/Counter Mode)
 * with PBKDF2 (Password-Based Key Derivation Function 2) for key derivation from a password.
 * AES-GCM is a symmetric encryption algorithm that provides both confidentiality and authenticity.
 * PBKDF2 is used to derive a strong cryptographic key from a password, making brute-force attacks harder.
 */

/**
 * Number of iterations for PBKDF2 key derivation. Higher values increase security by making key derivation slower,
 * which protects against dictionary attacks, but also increases computation time for encryption/decryption.
 */
const ITERATIONS = 600_000
const SALT_LEN   = 16                    // 128‑bit salt
const IV_LEN     = 12                    // 96‑bit IV (recommended for GCM)
const CHUNK_SIZE = 8_192                 // safe size for fromCharCode

/**
 * Converts an ArrayBuffer to a base64-encoded string.
 * This is useful for serializing binary data (like encrypted bytes) into a text format that can be stored or transmitted.
 * Uses btoa() which is a browser API for base64 encoding, with chunking to handle large buffers safely.
 * @param {ArrayBuffer} buffer - The ArrayBuffer to convert
 * @returns {string} The base64-encoded string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binaryString = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE)
    binaryString += String.fromCharCode(...chunk)
  }
  return btoa(binaryString)
}

/**
 * Converts a base64-encoded string back to an ArrayBuffer.
 * This reverses the process of bufferToBase64, allowing binary data to be reconstructed from text.
 * Uses atob() to decode base64, then builds a Uint8Array from the binary string, with chunking for large strings.
 * @param {string} b64 - The base64 string to convert
 * @returns {ArrayBuffer} The ArrayBuffer
 */
function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += CHUNK_SIZE) {
    const chunk = binary.slice(i, i + CHUNK_SIZE)
    for (let j = 0; j < chunk.length; j++) {
      bytes[i + j] = chunk.charCodeAt(j)
    }
  }
  return bytes.buffer
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
 * Returns a colon-separated string of base64-encoded salt, IV, and ciphertext.
 * This format allows the encrypted data to be stored as a string and later decrypted.
 * @param {string} plaintext - The text to encrypt
 * @param {string} password - The password for encryption
 * @param {string} aad - with additional authenticated data
 * @returns {Promise<string>} Promise resolving to the encrypted string
 */
export async function encryptField(plaintext: string, password: string, aad: string): Promise<string> {
  // Generate a random 16-byte salt for PBKDF2. Salt prevents rainbow table attacks.
  const saltArr = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  // Generate a random 12-byte IV for AES-GCM. IV ensures that identical plaintexts encrypt differently.
  const ivArr = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const salt = saltArr.buffer as ArrayBuffer
  const iv = ivArr.buffer as ArrayBuffer
  // Derive the encryption key from password and salt.
  const key = await deriveKey(password, salt)
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
  // Return the encrypted data as base64-encoded components separated by colons.
  return [bufferToBase64(salt), bufferToBase64(iv), bufferToBase64(ciphertext)].join(':')
}

/**
 * Decrypts an encrypted string back to plaintext using the password.
 * Expects the input to be in the format produced by encryptField: salt:iv:ciphertext (base64 encoded).
 * Throws an error if the format is invalid or decryption fails (e.g., wrong password).
 * @param {string} encoded - The encrypted string
 * @param {string} password - The password for decryption
 * @param {string} aad - with additional authenticated data
 * @returns {Promise<string>} Promise resolving to the decrypted plaintext
 */
export async function decryptField(encoded: string, password: string, aad: string): Promise<string> {
  // Split the encoded string into its components.
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [saltB64, ivB64, ciphertextB64] = parts
  // Decode the base64 components back to ArrayBuffers.
  const salt = base64ToBuffer(saltB64)
  const iv = base64ToBuffer(ivB64)
  const ciphertext = base64ToBuffer(ciphertextB64)
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

/**
 * Checks if a given string appears to be in the encrypted format.
 * This is a heuristic check: splits by ':' and verifies exactly 3 non-empty parts.
 * Useful for determining if a field needs decryption before use.
 * @param {string} value - The string to check
 * @returns {boolean} True if the string is in encrypted format
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}
