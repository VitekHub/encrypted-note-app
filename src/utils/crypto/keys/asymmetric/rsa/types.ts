import type { Argon2Params } from '../../../argon2Calibration/types'

/**
 * Service that manages the full lifecycle of a secure RSA-OAEP key pair:
 * generation (targeting 4096-bit), persistent storage, loading, existence checks,
 * deletion, and password rotation of the encrypted private key.
 *
 * All methods are asynchronous and rely on the Web Crypto API together with
 * the application's `cryptoKeyStorage` and `encryptField`/`decryptField`
 * helpers.
 */
export interface RsaKeyService {
  /**
   * Generates a fresh RSA-OAEP key pair (4096-bit with fallback to 2048 if needed)
   * and returns the raw CryptoKey objects.
   *
   * @returns A promise that resolves to an {@link CryptoKeyPair} containing the raw unencrypted keys.
   */
  generateKeys(): Promise<CryptoKeyPair>

  /**
   * Takes a generated RSA key pair, exports it, encrypts the private key
   * with the given password, and stores both values.
   *
   * @param keyPair - The RSA key pair (as returned by
   *   {@link generateKeys}) to store.
   * @param password - The user's master password used to encrypt the private key.
   * @returns A promise that resolves once both keys have been saved.
   */
  storeKeys(keyPair: CryptoKeyPair, password: string): Promise<void>

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
   * Re-encrypts the stored private key under a new password without
   * regenerating the key material itself.  The existing ciphertext is
   * decrypted with `oldPassword` and immediately re-encrypted with
   * `newPassword`, then written back to storage.
   *
   * @param oldPassword - The current master password used to decrypt the
   *   existing private key blob.
   * @param newPassword - The new master password used to re-encrypt the
   *   private key blob.
   * @param newParams - The new Argon2 parameters to use for re-encryption.
   * @returns A promise that resolves once the rotated key blob has been saved.
   * @throws {Error} If no private key is found in storage or decryption fails.
   */
  reEncryptPrivateKey(oldPassword: string, newPassword: string, newParams?: Argon2Params): Promise<void>

  /**
   * Rotates the RSA key pair: generates a new pair, re-wraps the master key
   * with the new public key, stores the new keys, and deletes the old private
   * key only after successful verification.
   *
   * Includes automatic rollback on failure.
   *
   * @param password - The user's master password required to decrypt the
   *   current private key and encrypt the new one.
   * @returns A promise that resolves once rotation is complete.
   * @throws {Error} If rotation fails; old keys are restored.
   */
  rotateKeys(password: string): Promise<void>
}
