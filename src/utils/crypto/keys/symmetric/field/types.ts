/**
 * Service for encrypting and decrypting individual fields using keys derived
 * from a master key via HKDF.
 *
 * Each call to encrypt generates a random salt that is combined with the
 * master key and the field identifier (used as HKDF info) to produce a
 * one-time AES-GCM key. The resulting blob concatenates salt, IV, and
 * ciphertext (base64) and is stored alongside any other field metadata.
 *
 * Decryption repeats the derivation using the same salt and field identifier.
 */

export interface FieldKeyService {
  /**
   * Encrypt plaintext using a field-specific key derived from the master key.
   * @param plaintext - data to encrypt
   * @param masterKey - the AES-GCM master key held in RAM
   * @param fieldId - unique identifier for the field (e.g. "note", "title")
   * @param aad - additional authenticated data bound to this encryption
   * @returns base64 string containing salt|iv|ciphertext
   */
  encrypt(plaintext: string, masterKey: CryptoKey, fieldId: string, aad: string): Promise<string>

  /**
   * Decrypt a blob produced by `encrypt` using the same master key and field
   * identifier.
   * @param encryptedBlob - base64 salt|iv|ciphertext
   * @param masterKey - same master key used during encryption
   * @param fieldId - same field identifier used during encryption
   * @param aad - same additional authenticated data used during encryption
   * @returns decrypted plaintext
   */
  decrypt(encryptedBlob: string, masterKey: CryptoKey, fieldId: string, aad: string): Promise<string>

  /**
   * Returns true if `value` appears to be a valid encrypted blob.
   */
  isEncrypted(value: string): boolean
}
