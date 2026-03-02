/**
 * Service provides operations for managing the **Master Key** – a cryptographically secure
 * random AES-256-GCM key used for field and data encryption throughout the application.
 *
 * **Security Model:**
 * - The Master Key is generated once during initial setup
 * - It is never stored in plaintext – only the RSA-wrapped version persists to storage
 * - The Master Key is wrapped using RSA public key (RSA-OAEP encryption)
 * - It is unwrapped using RSA private key when needed for encrypt/decrypt operations
 */
export interface MasterKeyService {
  /**
   * Generates a fresh cryptographically secure random Master Key (AES-256-GCM).
   *
   * This function:
   * - Creates a new AES-256-GCM key with full entropy
   * - Marks the key as extractable to enable RSA wrapping
   *
   * @returns {Promise<CryptoKey>} A promise that resolves to the raw unencrypted Master Key
   * @throws {Error} If key generation fails or RSA wrapping fails.
   */
  generateKey(): Promise<CryptoKey>

  /**
   * Persists the RSA-wrapped Master Key to IndexedDB storage.
   *
   * Wraps generatedMasterKey with raw RSA public key and stores it encoded in base64 format into storage.
   *
   * @param {CryptoKey} generatedMasterKey - The raw Master Key object.
   * @param {CryptoKey} rsaPublicKey - RSA public key (from RSA-2048 keypair) used to wrap the Master Key.
   *        Must have RSA-OAEP usage enabled.
   * @returns {Promise<void>} A promise that resolves when the key has been successfully stored.
   * @throws {Error} If storage operation fails.
   */
  storeKey(generatedMasterKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<void>

  /**
   * Retrieves the wrapped Master Key from storage and unwrapps it into a raw key.
   *
   * Loads the previously stored RSA-wrapped Master Key and decrypts it back to
   * its original CryptoKey form, making it usable for field/data encryption and decryption operations.
   *
   * @param {CryptoKey} rsaPrivateKey - The RSA private key corresponding to the public key
   *        that was used to wrap the Master Key. Must have RSA-OAEP usage enabled.
   * @returns {Promise<CryptoKey>} A promise that resolves to the unwrapped Master Key CryptoKey object.
   * @throws {Error} If:
   *         - No Master Key has been stored yet (triggering first-time setup)
   *         - Storage retrieval fails
   *         - Unwrapping fails
   */
  loadKey(rsaPrivateKey: CryptoKey): Promise<CryptoKey>

  /**
   * Checks whether a Master Key has been generated and stored.
   *
   * @returns {Promise<boolean>} A promise that resolves to `true` if a Master Key exists
   *          in storage, or `false` if no key has been generated yet.
   */
  hasKey(): Promise<boolean>

  /**
   * Permanently deletes the stored wrapped Master Key from storage.
   *
   * @returns {Promise<void>} A promise that resolves when the key has been deleted.
   */
  deleteKey(): Promise<void>

  /**
   * Encrypts plaintext using the Master Key with AES-256-GCM.
   *
   * Generates a random 96-bit IV per encryption, encrypts the plaintext
   * with the provided master key and additional authenticated data (AAD),
   * and returns the result as a base64 blob containing both IV and ciphertext.
   *
   * @param {string} plaintext - The plaintext to encrypt.
   * @param {CryptoKey} masterKey - The unwrapped AES-256-GCM master key.
   * @param {string} aad - Additional authenticated data that binds the ciphertext
   *        to a specific context (e.g., "userId:fieldName").
   * @returns {Promise<string>} A promise that resolves to the encrypted blob in base64 format: Base64(iv || ciphertext).
   * @throws {Error} If encryption fails.
   */
  encrypt(plaintext: string, masterKey: CryptoKey, aad: string): Promise<string>

  /**
   * Decrypts a master-key-encrypted blob using AES-256-GCM.
   *
   * Parses the IV and ciphertext from the base64 blob, then decrypts using
   * the provided master key and AAD. Returns the original plaintext.
   *
   * @param {string} encryptedBlob - The encrypted blob in base64 format (as produced by `encrypt`).
   * @param {CryptoKey} masterKey - The unwrapped AES-256-GCM master key.
   * @param {string} aad - The additional authenticated data used during encryption.
   *        Must match exactly or decryption will fail.
   * @returns {Promise<string>} A promise that resolves to the decrypted plaintext.
   * @throws {Error} If decryption fails (wrong key, corrupted data, AAD mismatch, etc.).
   */
  decrypt(encryptedBlob: string, masterKey: CryptoKey, aad: string): Promise<string>

  /**
   * Validates whether a blob appears to be a valid master-key-encrypted format.
   *
   * Performs basic structural validation (minimum length, valid base64),
   * but does not attempt decryption or cryptographic verification.
   *
   * @param {string} blob - The string to validate.
   * @returns {boolean} `true` if the blob appears to be valid master-key-encrypted format, `false` otherwise.
   */
  isEncrypted(blob: string): boolean
}
