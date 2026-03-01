/**
 * Service for encrypting and decrypting data using password-derived keys.
 *
 * This service provides methods to securely encrypt plaintext using a password,
 * with automatic generation of random salt and initialization vectors (IV) to ensure
 * each encryption is unique. Encrypted data is stored as a Base64-encoded blob
 * containing salt, IV, and ciphertext concatenated together, allowing it to be
 * persisted as a string and later decrypted.
 *
 * Additional authenticated data (AAD) can be provided to ensure encrypted content
 * cannot be used in different contexts without detection.
 *
 * @interface PasswordDerivedService
 */
export interface PasswordDerivedService {
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
  encrypt(plaintext: string, password: string, aad: string): Promise<string>

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
  decrypt(encryptedBlob: string, password: string, aad: string): Promise<string>

  /**
   * Checks if the given string is in encrypted format.
   * @param value - The string to check.
   * @returns True if the value can be parsed as an encrypted blob, False otherwise.
   */
  isEncrypted(value: string): boolean
}
