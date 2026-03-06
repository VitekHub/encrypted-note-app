/**
 * This module provides simple encryption and decryption utilities using AES-GCM (Galois/Counter Mode)
 * with Argon2id for key derivation from a password.
 * AES-GCM is a symmetric encryption algorithm that provides both confidentiality and authenticity.
 * Argon2id is a memory-hard key derivation function that protects against GPU/ASIC-based brute-force attacks,
 * making it more secure than PBKDF2 for deriving keys from passwords.
 */

import { argon2id } from 'hash-wasm'
import type { PasswordDerivedService } from './types'
import { Encryptor } from '../../../Encryptor'

/**
 * Parameters for Argon2id key derivation. These values balance security and performance:
 * - iterations: Number of passes (higher increases computation time).
 * - memorySize: Memory usage in KiB (higher makes GPU/ASIC attacks harder).
 * - parallelism: Number of threads (typically 4 for modern browsers/Node).
 * Higher values increase security by making key derivation slower and more resource-intensive,
 * which protects against dictionary attacks, but also increases computation time for encryption/decryption.
 */
const ARGON2_ITERATIONS = 3
const ARGON2_MEMORY = 64 * 1024 // 64 MiB (in KiB)
const ARGON2_PARALLELISM = 4 // threads
const ARGON2_HASH_LEN = 32 // 256-bit output (32 bytes)

const encryptor = new Encryptor()

/**
 * Derives a cryptographic key from a password and salt using Argon2id.
 * Argon2id stretches the password into a key suitable for AES-GCM encryption.
 * - Password is used directly in Argon2id hashing.
 * - Produces a 256-bit (32-byte) raw hash, which is imported as an AES-GCM key.
 * This function is asynchronous because key derivation involves cryptographic operations.
 * @param {string} password - The password string
 * @param {Uint8Array} salt - The salt Uint8Array (must be provided; generated randomly for encryption)
 * @returns {Promise<CryptoKey>} Promise resolving to the derived CryptoKey
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // Use Argon2id to derive a 256-bit (32-byte) raw key from the password and salt.
  const hashHex = await argon2id({
    password,
    salt,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY,
    parallelism: ARGON2_PARALLELISM,
    hashLength: ARGON2_HASH_LEN,
    outputType: 'hex',
  })

  // Convert hex to Uint8Array for key import.
  const hashBytes = new Uint8Array(hashHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))

  // Import the derived raw hash as a CryptoKey for AES-GCM.
  return crypto.subtle.importKey(
    'raw',
    hashBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false, // Not extractable
    ['encrypt', 'decrypt'] // Allowed usages
  )
}

export const passwordDerivedService: PasswordDerivedService = {
  /** @inheritdoc */
  async encrypt(plaintext: string, password: string, aad: string): Promise<string> {
    const salt = encryptor.getRandomSalt()
    // Derive the encryption key from password and salt using Argon2id.
    const key = await deriveKey(password, salt)
    // Encrypt the plaintext using AES-GCM with the derived key and IV.
    return encryptor.encrypt(plaintext, key, salt, aad)
  },

  /** @inheritdoc */
  async decrypt(encryptedBlob: string, password: string, aad: string): Promise<string> {
    // Decode, validate the base64 blob and slice to salt, iv and cipherText
    const { salt, iv, ciphertext } = encryptor.parseBlob(encryptedBlob)
    // Derive the decryption key using the same password and extracted salt.
    const key = await deriveKey(password, salt)
    // Decrypt the ciphertext using AES-GCM with the derived key and IV.
    return encryptor.decrypt(ciphertext, key, iv, aad)
  },

  /** @inheritdoc */
  isEncrypted(value: string): boolean {
    return encryptor.isEncrypted(value)
  },
}
