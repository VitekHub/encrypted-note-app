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
   * - Wraps the raw key material using the RSA public key (RSA-OAEP)
   *
   * **Should be called only once during initial setup.** Calling it multiple times
   * will generate different keys, invalidating previous encrypted data.
   *
   * @param {CryptoKey} rsaPublicKey - RSA public key (from RSA-2048 keypair) used to wrap the Master Key.
   *        Must have RSA-OAEP usage enabled.
   * @returns {Promise<string>} A promise that resolves to the wrapped Master Key encoded in base64 format.
   *          This string value is safe to persist to storage and is the format expected by `storeKey()`.
   * @throws {Error} If key generation fails or RSA wrapping fails.
   */
  generateKey(rsaPublicKey: CryptoKey): Promise<string>

  /**
   * Unwraps the stored Master Key using the RSA private key.
   *
   * Decrypts the RSA-wrapped Master Key back to its original CryptoKey form,
   * making it usable for field/data encryption and decryption operations.
   *
   * @param {ArrayBuffer} wrappedMasterKey - The RSA-wrapped Master Key in binary format.
   * @param {CryptoKey} rsaPrivateKey - The RSA private key corresponding to the public key
   *        that was used to wrap the Master Key. Must have RSA-OAEP usage enabled.
   * @returns {Promise<CryptoKey>} A promise that resolves to the unwrapped Master Key CryptoKey object.
   * @throws {Error} If unwrapping fails.
   */
  unwrapKey(wrappedMasterKey: ArrayBuffer, rsaPrivateKey: CryptoKey): Promise<CryptoKey>

  /**
   * Persists the RSA-wrapped Master Key to IndexedDB storage.
   *
   * @param {string} wrappedMasterKey - The wrapped Master Key in base64 format.
   * @returns {Promise<void>} A promise that resolves when the key has been successfully stored.
   * @throws {Error} If storage operation fails.
   */
  storeKey(wrappedMasterKey: string): Promise<void>

  /**
   * Retrieves the wrapped Master Key from IndexedDB storage.
   *
   * Loads the previously stored RSA-wrapped Master Key and converts it from
   * base64 format back to binary (ArrayBuffer) format, ready for unwrapping
   * with the RSA private key.
   *
   * @returns {Promise<ArrayBuffer>} A promise that resolves to the wrapped Master Key
   *          as an ArrayBuffer (binary format).
   * @throws {Error} If:
   *         - No Master Key has been stored yet (triggering first-time setup)
   *         - Storage retrieval fails due to IndexedDB issues
   *         - The stored key data is corrupted or invalid base64
   */
  loadKey(): Promise<ArrayBuffer>

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
}
