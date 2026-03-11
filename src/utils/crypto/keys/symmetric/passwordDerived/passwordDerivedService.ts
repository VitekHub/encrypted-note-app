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
import type { Argon2Params } from '../../../argon2Calibration'
import { FALLBACK_ARGON2_PARAMS } from '../../../argon2Calibration'

/** 4 params × 4 bytes each = 16 bytes of metadata in the blob. */
const ARGON2_METADATA_LEN = 16

export class PasswordDerivedServiceImpl implements PasswordDerivedService {
  private params: Argon2Params
  private metadata: Uint8Array
  private readonly encryptor: Encryptor

  constructor(argon2Params?: Partial<Argon2Params>) {
    this.params = { ...FALLBACK_ARGON2_PARAMS, ...argon2Params }
    this.metadata = this.serializeArgon2Params(this.params)
    this.encryptor = new Encryptor({ metadataLen: ARGON2_METADATA_LEN })
  }

  /**
   * Derives a cryptographic key from a password and salt using Argon2id.
   * Argon2id stretches the password into a key suitable for AES-GCM encryption.
   * - Password is used directly in Argon2id hashing.
   * - Produces a raw hash of configurable length, which is imported as an AES-GCM key.
   * This function is asynchronous because key derivation involves cryptographic operations.
   * @param {string} password - The password string
   * @param {Uint8Array} salt - The salt Uint8Array (must be provided; generated randomly for encryption)
   * @returns {Promise<CryptoKey>} Promise resolving to the derived CryptoKey
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // Use Argon2id to derive a raw key from the password and salt.
    const hashHex = await argon2id({
      password,
      salt,
      iterations: this.params.iterations,
      memorySize: this.params.memorySize,
      parallelism: this.params.parallelism,
      hashLength: this.params.hashLength,
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

  /**
   * Serializes Argon2 parameters into a 16-byte Uint8Array (4 × Uint32, big-endian).
   */
  private serializeArgon2Params(params: Argon2Params): Uint8Array {
    const buf = new ArrayBuffer(ARGON2_METADATA_LEN)
    const view = new DataView(buf)
    view.setUint32(0, params.iterations)
    view.setUint32(4, params.memorySize)
    view.setUint32(8, params.parallelism)
    view.setUint32(12, params.hashLength)
    return new Uint8Array(buf)
  }

  /**
   * Deserializes Argon2 parameters from a 16-byte Uint8Array (4 × Uint32, big-endian).
   */
  private deserializeArgon2Params(metadata: Uint8Array): Argon2Params {
    const view = new DataView(metadata.buffer, metadata.byteOffset, metadata.byteLength)
    return {
      iterations: view.getUint32(0),
      memorySize: view.getUint32(4),
      parallelism: view.getUint32(8),
      hashLength: view.getUint32(12),
    }
  }

  /** @inheritdoc */
  async encrypt(plaintext: string, password: string, aad: string): Promise<string> {
    const salt = this.encryptor.getRandomSalt()
    // Derive the encryption key from password and salt using Argon2id.
    const key = await this.deriveKey(password, salt)
    // Encrypt the plaintext using AES-GCM with the derived key and IV.
    return this.encryptor.encrypt(plaintext, key, salt, aad, this.metadata)
  }

  /** @inheritdoc */
  async decrypt(encryptedBlob: string, password: string, aad: string): Promise<string> {
    // Decode, validate the base64 blob and slice to salt, metadata, iv and ciphertext
    const { salt, metadata, iv, ciphertext } = this.encryptor.parseBlob(encryptedBlob)
    // Update params and metadata if needed
    this.updateParams(metadata)
    // Derive the decryption key using the same password and extracted salt.
    const key = await this.deriveKey(password, salt)
    // Decrypt the ciphertext using AES-GCM with the derived key and IV.
    return this.encryptor.decrypt(ciphertext, key, iv, aad)
  }

  /** @inheritdoc */
  isEncrypted(value: string): boolean {
    return this.encryptor.isEncrypted(value)
  }

  /** @inheritdoc */
  getParams(): Argon2Params {
    return this.params
  }

  /** @inheritdoc */
  setParams(params: Argon2Params): void {
    this.params = params
    this.metadata = this.serializeArgon2Params(params)
  }

  /**
   * Updates the Argon2 parameters and metadata if the provided metadata is different from the current one.
   * @param metadata - The new metadata to use for key derivation
   */
  private updateParams(metadata: Uint8Array | null): void {
    if (metadata) {
      this.params = this.deserializeArgon2Params(metadata)
      this.metadata = metadata
    }
  }
}

/** Default instance using standard Argon2id parameters. */
export const passwordDerivedService: PasswordDerivedService = new PasswordDerivedServiceImpl()
