import type { CalibrationResult, Argon2Params } from '../argon2Calibration'

/**
 * High-level cryptographic service that orchestrates the full key setup,
 * unlock, and teardown flows. Acts as a facade over RSA and Master Key services.
 *
 * **Security Model:**
 * - On setup: Generates RSA-4096 key pair, wraps & stores it, generates & wraps master key
 * - On unlock: Loads RSA private key, loads wrapped master key, unwraps master key in memory
 * - Returns unwrapped master key to caller for data encryption/decryption
 * - Master key never persisted; only kept in memory during session
 */
export interface CryptoService {
  /**
   * Called during sign-up: Generates and stores both RSA key pair and Master Key.
   *
   * This function:
   * - Generates a new RSA-4096 key pair
   * - Encrypts the private key with the provided password and stores both keys
   * - Generates a fresh Master Key and wraps it with the RSA public key
   * - Stores the wrapped Master Key
   * - Returns the unwrapped Master Key for use during this session
   *
   * @param password - The user's master password for protecting the RSA private key
   * @returns A promise that resolves to an object containing the unwrapped
   *          Master Key (CryptoKey) and the calibrated Argon2id parameters used.
   * @throws {Error} If key generation or storage fails
   */
  setup(password: string): Promise<{ masterKey: CryptoKey; params: Argon2Params }>

  /**
   * Called during login: Loads and unwraps both RSA and Master Keys.
   *
   * This function:
   * - Loads and decrypts the RSA private key using the password
   * - Loads the wrapped Master Key from storage
   * - Unwraps the Master Key using the RSA private key
   * - Returns the unwrapped Master Key for use during this session
   *
   * @param password - The user's master password for decrypting the RSA private key
   * @returns A promise that resolves to an object containing the unwrapped
   *          Master Key (CryptoKey) and the calibrated Argon2id parameters used.
   * @throws {Error} If loading, decryption, or unwrapping fails (e.g., wrong password)
   */
  unlock(password: string): Promise<{ masterKey: CryptoKey; params: Argon2Params }>

  /**
   * Checks whether the full key setup is complete (both RSA keys and Master Key exist).
   *
   * @returns A promise that resolves to `true` only if both RSA key pair and
   *          Master Key are present in storage, `false` otherwise
   */
  isSetUp(): Promise<boolean>

  /**
   * Encrypt plaintext using a field-specific key derived from the master key.
   * @param data - data to encrypt
   * @param masterKey - the AES-GCM master key held in RAM
   * @param fieldId - unique identifier for the field (e.g. "note", "title")
   * @param userId - unique identifier for the user (e.g. "user123")
   * @param aad - additional authenticated data bound to this encryption
   * @returns base64 string containing salt|iv|ciphertext
   */
  encrypt(data: string, masterKey: CryptoKey, fieldId: string, userId: string): Promise<string>

  /**
   * Decrypt a blob produced by `encrypt` using the same master key.
   * @param data - encrypted base64 salt|iv|ciphertext
   * @param masterKey - same master key used during encryption
   * @param fieldId - same field identifier used during encryption
   * @param userId - same user identifier used during encryption
   * @returns decrypted plaintext
   */
  decrypt(data: string, masterKey: CryptoKey, fieldId: string, userId: string): Promise<string>

  /**
   * Returns true if `value` appears to be a valid encrypted blob.
   */
  isEncrypted(value: string): boolean

  /**
   * Rotates the RSA key pair, re-wrapping the master key with the new public key.
   *
   * @param password - The user's master password.
   * @returns A promise that resolves once rotation is complete.
   * @throws {Error} If rotation fails.
   */
  rotateRsaKeys(password: string): Promise<void>

  /**
   * Re-encrypts the stored RSA private key under a new password without
   * regenerating the key material itself.  The existing ciphertext is
   * decrypted with `oldPassword` and immediately re-encrypted with
   * `newPassword`, then written back to storage.
   *
   * Does NOT update Supabase Auth credentials — callers are responsible for
   * deriving the new auth token and calling `supabase.auth.updateUser` before
   * (or after) invoking this method.
   *
   * @param oldPassword - The current master password used to decrypt the
   *   existing private key blob.
   * @param newPassword - The new master password used to re-encrypt the
   *   private key blob.
   * @returns A promise that resolves once the rotated key blob has been saved.
   * @throws {Error} If no private key is found in storage or decryption fails.
   */
  updatePassword(oldPassword: string, newPassword: string): Promise<void>

  /**
   * Updates the Argon2 parameters used for key derivation.
   *
   * @param password - The user's master password.
   * @param newParams - The new Argon2 parameters to use.
   * @returns A promise that resolves once the parameters have been updated.
   * @throws {Error} If no private key is found in storage or decryption fails.
   */
  updateParams(password: string, newParams: Argon2Params): Promise<void>

  /**
   * Calibrates Argon2id parameters to the current device's capabilities.
   *
   * @returns {Promise<CalibrationResult>} The calibrated parameters
   */
  calibrateToDeviceCapability(): Promise<CalibrationResult>

  /**
   * Permanently deletes all cryptographic keys from storage.
   *
   * Called when the user requests "Drop Database" / full account wipe.
   * Removes RSA public key, encrypted RSA private key, and wrapped Master Key.
   *
   * @returns A promise that resolves once all keys have been deleted
   */
  teardown(): Promise<void>

  /**
   * Clears sensitive data from memory, such as field keys and other temporary variables.
   * This is typically called upon session lock or when the application goes idle.
   */
  clear(): void
}
