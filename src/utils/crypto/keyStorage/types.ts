export interface CryptoKeyStorage {
  /**
   * Retrieves the value associated with the given key name.
   *
   * @param keyName - Unique identifier of the stored item (e.g. 'rsa_public_key_spki')
   * @returns Promise resolving to the stored string (usually base64) or `undefined` if not found
   */
  get(keyName: string): Promise<string | undefined>

  /**
   * Stores (or overwrites) a value under the given key name.
   *
   * @param keyName - Unique identifier for the cryptographic item
   * @param value - String value to store (typically base64-encoded)
   * @returns Promise that resolves when the write completes
   */
  set(keyName: string, value: string): Promise<void>

  /**
   * Removes the entry with the given key name from storage.
   *
   * @param keyName - Identifier of the item to delete
   * @returns Promise that resolves when the deletion completes
   */
  delete(keyName: string): Promise<void>

  /**
   * Checks whether an entry with the given key name exists in storage.
   *
   * @param keyName - Identifier to check
   * @returns `true` if a value is stored under this key, `false` otherwise
   */
  has(keyName: string): Promise<boolean>
}
