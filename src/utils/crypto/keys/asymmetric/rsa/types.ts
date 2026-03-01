export interface RsaKeyPair {
  publicKeyBase64: string
  encryptedPrivateKey: string
}

/**
 * Service that manages the full lifecycle of an RSA-OAEP 2048-bit key pair:
 * generation, persistent storage, loading, existence checks, deletion, and
 * password rotation of the encrypted private key.
 *
 * All methods are asynchronous and rely on the Web Crypto API together with
 * the application's `cryptoKeyStorage` and `encryptField`/`decryptField`
 * helpers.
 */
export interface RsaKeyService {
  /**
   * Generates a fresh RSA-OAEP 2048-bit key pair and returns the serialised
   * form ready for storage.  The private key is immediately encrypted with
   * `encryptField` using the supplied password so it is never held in memory
   * in plain-text form beyond this call.
   *
   * @param password - The user's master password used to encrypt the private key.
   * @returns A promise that resolves to an {@link RsaKeyPair} containing the
   *   SPKI-encoded public key (base64) and the encrypted private key blob.
   */
  generateKeys(password: string): Promise<RsaKeyPair>

  /**
   * Persists both halves of an {@link RsaKeyPair} to the application's
   * key storage.  Both writes are performed concurrently.
   *
   * @param keyPair - The serialised key pair (as returned by
   *   {@link generateKeys}) to store.
   * @returns A promise that resolves once both keys have been saved.
   */
  storeKeys(keyPair: RsaKeyPair): Promise<void>

  /**
   * Retrieves and imports the RSA public key from storage as a non-extractable
   * `CryptoKey` suitable for encryption and key-wrapping operations.
   *
   * @returns A promise that resolves to the imported RSA-OAEP public
   *   `CryptoKey` with usages `['encrypt', 'wrapKey']`.
   * @throws {Error} If no public key is found in storage.
   */
  loadPublicKey(): Promise<CryptoKey>

  /**
   * Retrieves, decrypts, and imports the RSA private key from storage as a
   * non-extractable `CryptoKey` suitable for decryption and key-unwrapping.
   *
   * @param password - The user's master password required to decrypt the
   *   stored private key blob.
   * @returns A promise that resolves to the imported RSA-OAEP private
   *   `CryptoKey` with usages `['decrypt', 'unwrapKey']`.
   * @throws {Error} If no private key is found in storage or decryption fails.
   */
  loadPrivateKey(password: string): Promise<CryptoKey>

  /**
   * Checks whether a complete RSA key pair (both public and private) is
   * present in storage.
   *
   * @returns A promise that resolves to `true` when both keys exist in
   *   storage, `false` otherwise.
   */
  hasKeys(): Promise<boolean>

  /**
   * Removes both the public and private keys from storage.  Both deletions
   * are performed concurrently.
   *
   * @returns A promise that resolves once both keys have been deleted.
   */
  deleteKeys(): Promise<void>

  /**
   * Re-encrypts the stored private key under a new password without
   * regenerating the key material itself.  The existing ciphertext is
   * decrypted with `oldPassword` and immediately re-encrypted with
   * `newPassword`, then written back to storage.
   *
   * @param oldPassword - The current master password used to decrypt the
   *   existing private key blob.
   * @param newPassword - The new master password used to re-encrypt the
   *   private key blob.
   * @returns A promise that resolves once the rotated key blob has been saved.
   * @throws {Error} If no private key is found in storage or decryption fails.
   */
  updatePassword(oldPassword: string, newPassword: string): Promise<void>
}
