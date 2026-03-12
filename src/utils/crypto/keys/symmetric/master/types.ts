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
   * Wraps unwrapped Master key with raw RSA public key.
   *
   * @param {CryptoKey} unwrappedMasterKey - The raw Master Key object.
   * @param {CryptoKey} rsaPublicKey - RSA public key (from RSA-4096 keypair) used to wrap the Master Key.
   *        Must have RSA-OAEP usage enabled.
   * @returns {Promise<string>} A promise that resolves to the base64 wrapped Master key.
   * @throws {Error} If wrap operation fails.
   */
  wrapKey(unwrappedMasterKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<string>

  /**
   * Persists the RSA-wrapped Master Key to storage.
   *
   * @param {string} wrappedMasterKeyBase64 - The base64 wrapped Master key
   * @returns {Promise<void>} A promise that resolves when the key has been successfully stored.
   */
  storeKey(wrappedMasterKeyBase64: string): Promise<void>

  /**
   * Retrieves the wrapped Master Key from storage
   *
   * Loads the previously stored RSA-wrapped Master Key as base64 string.
   *
   * @returns {Promise<string>} A promise that resolves to the unwrapped base64 Master Key.
   * @throws {Error} If:
   *         - No Master Key has been stored yet (triggering first-time setup)
   *         - Storage retrieval fails
   */
  loadKey(): Promise<string>

  /**
   * Unwrapps Master Key into a raw key.
   *
   * Decrypts RSA-wrapped Master Key back to its original CryptoKey form, making it usable for field/data encryption and decryption operations.
   *
   * @param {string} wrappedMasterKey - The wrapped base64 Master key.
   * @param {CryptoKey} rsaPrivateKey - The RSA private key corresponding to the public key
   *        that was used to wrap the Master Key. Must have RSA-OAEP usage enabled.
   * @returns {Promise<CryptoKey>} A promise that resolves to the unwrapped Master Key CryptoKey object.
   * @throws {Error} If unwrapping fails
   */
  unwrapKey(wrappedMasterKey: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey>

  /**
   * Converts an extractable AES-256-GCM master key into a non-extractable HKDF key
   * for secure key derivation.
   *
   * The resulting key can only be used with `deriveKey` / `deriveBits`.
   *
   * @param unwrappedMasterKey - Extractable unwrapped master key
   * @returns {Promise<CryptoKey>} A promise that resolves to Non-extractable HKDF key (SHA-256)
   * @throws If conversion fails or input key is invalid
   */
  convertToDerivable(unwrappedMasterKey: CryptoKey): Promise<CryptoKey>

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
