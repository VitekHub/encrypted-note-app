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
const ITERATIONS = 100_000

/**
 * Converts an ArrayBuffer to a base64-encoded string.
 * This is useful for serializing binary data (like encrypted bytes) into a text format that can be stored or transmitted.
 * Uses btoa() which is a browser API for base64 encoding.
 * @param {ArrayBuffer} buffer - The ArrayBuffer to convert
 * @returns {string} The base64-encoded string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

/**
 * Converts a base64-encoded string back to an ArrayBuffer.
 * This reverses the process of bufferToBase64, allowing binary data to be reconstructed from text.
 * Uses atob() to decode base64, then builds a Uint8Array from the binary string.
 * @param {string} b64 - The base64 string to convert
 * @returns {ArrayBuffer} The ArrayBuffer
 */
function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
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
  const enc = new TextEncoder()
  /** Encode the password string into UTF-8 bytes. */
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false, // Not extractable
    ['deriveKey'] // Allowed usages
  )
  /** Derive the key using PBKDF2 with SHA-256 hash, specified iterations, and the provided salt. */
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
 * @returns {Promise<string>} Promise resolving to the encrypted string
 */
export async function encryptField(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  /** Generate a random 16-byte salt for PBKDF2. Salt prevents rainbow table attacks. */
  const saltArr = crypto.getRandomValues(new Uint8Array(16))
  /** Generate a random 12-byte IV for AES-GCM. IV ensures that identical plaintexts encrypt differently. */
  const ivArr = crypto.getRandomValues(new Uint8Array(12))
  const salt = saltArr.buffer as ArrayBuffer
  const iv = ivArr.buffer as ArrayBuffer
  /** Derive the encryption key from password and salt. */
  const key = await deriveKey(password, salt)
  /** Encrypt the plaintext using AES-GCM with the derived key and IV. */
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext) // Encode plaintext to bytes
  )
  /** Return the encrypted data as base64-encoded components separated by colons. */
  return [bufferToBase64(salt), bufferToBase64(iv), bufferToBase64(ciphertext)].join(':')
}

/**
 * Decrypts an encrypted string back to plaintext using the password.
 * Expects the input to be in the format produced by encryptField: salt:iv:ciphertext (base64 encoded).
 * Throws an error if the format is invalid or decryption fails (e.g., wrong password).
 * @param {string} encoded - The encrypted string
 * @param {string} password - The password for decryption
 * @returns {Promise<string>} Promise resolving to the decrypted plaintext
 */
export async function decryptField(encoded: string, password: string): Promise<string> {
  /** Split the encoded string into its components. */
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [saltB64, ivB64, ciphertextB64] = parts
  /** Decode the base64 components back to ArrayBuffers. */
  const salt = base64ToBuffer(saltB64)
  const iv = base64ToBuffer(ivB64)
  const ciphertext = base64ToBuffer(ciphertextB64)
  /** Derive the decryption key using the same password and extracted salt. */
  const key = await deriveKey(password, salt)
  /** Decrypt the ciphertext using AES-GCM with the derived key and IV. */
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  /** Decode the decrypted bytes back to a string. */
  return new TextDecoder().decode(plainBuffer)
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
