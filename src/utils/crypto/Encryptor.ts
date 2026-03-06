import { fromUint8Array, toUint8Array } from 'js-base64'

/**
 * Utility class for AES-GCM (or compatible) encryption/decryption using the Web Crypto API.
 *
 * Handles random salt/IV generation, base64-encoded blob formatting (salt || iv || ciphertext),
 * and authenticated encryption with optional additional authenticated data (AAD).
 *
 * **Important security notes**:
 * - Always use a fresh random salt per encryption (for key derivation)
 * - Always use a fresh random IV per encryption
 * - AAD is authenticated but **not** encrypted — use it for context (e.g. version, recipient ID)
 * - Authentication tag is automatically appended/verified by AES-GCM
 * - Decryption fails (throws `Error`) on any tampering, wrong key, wrong AAD, etc.
 */
export class Encryptor {
  private readonly SALT_LEN: number
  private readonly IV_LEN: number
  private readonly ALGORITHM: string

  constructor(
    options: {
      saltLen?: number
      ivLen?: number
      algorithm?: string
    } = {}
  ) {
    this.SALT_LEN = options.saltLen ?? 16
    this.IV_LEN = options.ivLen ?? 12
    this.ALGORITHM = options.algorithm ?? 'AES-GCM'
  }

  /**
   * Generates a cryptographically secure random salt.
   *
   * @returns A new random salt suitable for key derivation.
   */
  public getRandomSalt(): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LEN))
  }

  /**
   * Decodes a base64 string, validates it meets the minimum blob length and extracts salt, initialization vector and ciphertext.
   * @param {string} value - The base64 string to decode
   * @returns {Uint8Array} The decoded bytes
   * @throws If the input is not valid base64 or the blob is too short
   */
  public parseBlob(value: string): {
    salt: Uint8Array<ArrayBuffer>
    iv: Uint8Array<ArrayBuffer>
    ciphertext: Uint8Array<ArrayBuffer>
  } {
    const bytes = toUint8Array(value)
    const minBlobLen = this.SALT_LEN + this.IV_LEN + 1
    if (bytes.length < minBlobLen) throw new Error('Invalid encrypted format')

    const offsetIv = this.SALT_LEN
    const offsetData = this.SALT_LEN + this.IV_LEN
    const salt = bytes.slice(0, offsetIv)
    const iv = bytes.slice(offsetIv, offsetData)
    const ciphertext = bytes.slice(offsetData)
    return { salt, iv, ciphertext }
  }

  /**
   * Concatenate multiple Uint8Arrays and return the result as a base64-encoded string.
   * This encodes the combined bytes into a base64 string suitable for storage or transmission.
   * @param {...Uint8Array} arrays - One or more Uint8Arrays to concatenate
   * @returns {string} A base64-encoded string of the concatenated bytes
   */
  public concatToBase64(...arrays: Uint8Array[]): string {
    const totalLength = arrays.reduce((sum, a) => sum + a.byteLength, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const arr of arrays) {
      result.set(arr, offset)
      offset += arr.byteLength
    }
    return fromUint8Array(result)
  }

  /**
   * Encode a text string to an ArrayBuffer (UTF-8).
   * This is a small helper that wraps `TextEncoder` to produce a binary buffer
   * suitable for use as input to Web Crypto APIs.
   * @param {string} text - The text to encode
   * @returns {ArrayBuffer} The encoded text as an ArrayBuffer
   */
  public textToBuffer(text: string): ArrayBuffer {
    return new TextEncoder().encode(text).buffer
  }

  /**
   * Decode an ArrayBuffer (UTF-8) back to a string.
   * Wraps `TextDecoder` for convenience when converting decrypted bytes to text.
   * @param {ArrayBuffer} buffer - The buffer to decode
   * @returns {string} The decoded string
   */
  public bufferToText(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer)
  }

  /**
   * Encrypts a string using AES-GCM (or the configured algorithm) with the provided key.
   *
   * The output is a base64-encoded string containing:
   * `salt || iv || ciphertext`
   *
   * The salt is **not** encrypted — it is prepended so the recipient can perform key derivation.
   * The `additionalData` (AAD) is authenticated but **not** encrypted.
   *
   * @param {string} data - The plaintext string to encrypt
   * @param {CryptoKey} key - The AES-GCM encryption key (CryptoKey with 'encrypt' usage)
   * @param {Uint8Array} salt - The salt bytes (typically from `getRandomSalt()` or `parseBlob()`)
   * @param {string} aad - Additional authenticated data (will be verified during decryption)
   * @returns {string} Base64-encoded string: salt + IV + ciphertext
   * @throws {Error} If encryption fails (e.g. invalid key, algorithm mismatch)
   */
  public async encrypt(data: string, key: CryptoKey, salt: Uint8Array<ArrayBuffer>, aad: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LEN))
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv,
        additionalData: this.textToBuffer(aad),
      },
      key,
      this.textToBuffer(data)
    )

    return this.concatToBase64(salt, iv, new Uint8Array(ciphertext))
  }

  /**
   * Decrypts AES-GCM (or the configured algorithm) ciphertext back to the original string.
   *
   * The caller must supply the correct IV and AAD — otherwise decryption will fail.
   *
   * @param {Uint8Array} data - The raw ciphertext bytes (usually from `parseBlob().ciphertext`)
   * @param {CryptoKey} key - The AES-GCM decryption key (CryptoKey with 'decrypt' usage)
   * @param {Uint8Array} iv - The initialization vector used during encryption
   * @param {string} aad - The same additional authenticated data string passed to `encrypt`
   * @returns {string} The decrypted plaintext string
   * @throws {Error} If decryption fails (algorithm mismatch, etc.)
   */
  public async decrypt(
    data: Uint8Array<ArrayBuffer>,
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    aad: string
  ): Promise<string> {
    const plainBuffer = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv,
        additionalData: this.textToBuffer(aad),
      },
      key,
      data
    )
    return this.bufferToText(plainBuffer)
  }

  /**
   * Checks if the given string is in encrypted format.
   * @param value - The string to check.
   * @returns True if the value can be parsed as an encrypted blob, False otherwise.
   */
  isEncrypted(value: string): boolean {
    if (!value) return false
    try {
      this.parseBlob(value)
      return true
    } catch {
      return false
    }
  }
}
