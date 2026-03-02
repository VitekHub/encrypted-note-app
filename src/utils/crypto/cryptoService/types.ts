/**
 * High-level cryptographic service that orchestrates the full key setup,
 * unlock, and teardown flows. Acts as a facade over RSA and Master Key services.
 *
 * **Security Model:**
 * - On setup: Generates RSA-2048 key pair, wraps & stores it, generates & wraps master key
 * - On unlock: Loads RSA private key, loads wrapped master key, unwraps master key in memory
 * - Returns unwrapped master key to caller for data encryption/decryption
 * - Master key never persisted; only kept in memory during session
 */
export interface CryptoService {
  /**
   * Called during sign-up: Generates and stores both RSA key pair and Master Key.
   *
   * This function:
   * - Generates a new RSA-2048 key pair
   * - Encrypts the private key with the provided password and stores both keys
   * - Generates a fresh Master Key and wraps it with the RSA public key
   * - Stores the wrapped Master Key
   * - Returns the unwrapped Master Key for use during this session
   *
   * @param password - The user's master password for protecting the RSA private key
   * @returns A promise that resolves to the unwrapped Master Key (CryptoKey)
   * @throws {Error} If key generation or storage fails
   */
  setup(password: string): Promise<CryptoKey>

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
   * @returns A promise that resolves to the unwrapped Master Key (CryptoKey)
   * @throws {Error} If loading, decryption, or unwrapping fails (e.g., wrong password)
   */
  unlock(password: string): Promise<CryptoKey>

  /**
   * Checks whether the full key setup is complete (both RSA keys and Master Key exist).
   *
   * @returns A promise that resolves to `true` only if both RSA key pair and
   *          Master Key are present in storage, `false` otherwise
   */
  isSetUp(): Promise<boolean>

  /**
   * Permanently deletes all cryptographic keys from storage.
   *
   * Called when the user requests "Drop Database" / full account wipe.
   * Removes RSA public key, encrypted RSA private key, and wrapped Master Key.
   *
   * @returns A promise that resolves once all keys have been deleted
   */
  teardown(): Promise<void>
}
