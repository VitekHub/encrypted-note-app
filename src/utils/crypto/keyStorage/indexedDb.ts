/**
 * Unified storage layer for all cryptographic material
 * (RSA public key, encrypted RSA private key, wrapped master key, salts, etc.)
 * Currently backed by IndexedDB + idb library.
 * Later you can swap the entire object with a Supabase implementation.
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { CryptoKeyStorage } from './types'

const CRYPTO_DB_NAME    = 'app-crypto'
const CRYPTO_STORE_NAME = 'keys'
const CRYPTO_DB_VERSION = 1

// Singleton database promise – opened only once
let dbPromise: Promise<IDBPDatabase> | null = null

/**
 * Singleton factory that returns the IndexedDB database connection.
 * Opens (or reuses) the connection lazily - only one connection is kept alive.
 *
 * The database is automatically upgraded/created on first use.
 * Uses object store `${CRYPTO_STORE_NAME}` for all key-value pairs.
 */
function getCryptoDb(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = openDB(CRYPTO_DB_NAME, CRYPTO_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CRYPTO_STORE_NAME)) {
        db.createObjectStore(CRYPTO_STORE_NAME)
      }
    },
    blocked() {
      console.warn(`IndexedDB ${CRYPTO_DB_NAME} blocked - another tab may have it open`)
    },
    blocking(_currentVersion, _blockedVersion, event) {
      const db = event.target as IDBDatabase
      if (db) db.close()
      dbPromise = null
    },
  }).catch((err) => {
    dbPromise = null
    throw new Error(`CryptoKeyStorage: failed to open IndexedDB "${CRYPTO_DB_NAME}" - ${err}`)
  })

  return dbPromise
}

/**
 * Unified storage layer for all cryptographic material.
 *
 * This module provides a clean, promise-based key-value interface for storing
 * sensitive cryptographic blobs such as:
 * - RSA public key (plain base64 SPKI)
 * - Encrypted RSA private key (AES-GCM + Argon2id-derived from password)
 * - Wrapped master key (RSA-OAEP encrypted)
 * - Future HKDF salts, key versions, recovery keys, etc.
 *
 * Current backend: IndexedDB via `idb` library (client-side only, persistent across sessions).
 * Future backend: Supabase table (e.g. `crypto_keys`) with RLS — the interface stays identical.
 *
 * All values are stored as strings (typically base64-encoded).
 * Never store plaintext keys or master key bytes here — only wrapped/encrypted forms.
 *
 * Usage example:
 * ```ts
 * await cryptoKeyStorage.set('rsa_public_key_spki', publicKeyBase64)
 * const wrapped = await cryptoKeyStorage.get('wrapped_master_key')
 * if (await cryptoKeyStorage.has('rsa_private_key_encrypted')) { ... }
 * ```
 */
export const indexedDbKeyStorage: CryptoKeyStorage = {
  /**
   * @inheritdoc
   * 
   * @throws May reject if IndexedDB fails to open or read (rare in normal usage)
   */
  async get(keyName: string): Promise<string | undefined> {
    const db = await getCryptoDb()
    return db.get(CRYPTO_STORE_NAME, keyName)
  },

  /**
   * @inheritdoc
   * 
   * @throws May reject if IndexedDB transaction fails (disk full, quota exceeded, etc.)
   */
  async set(keyName: string, value: string): Promise<void> {
    const db = await getCryptoDb()
    await db.put(CRYPTO_STORE_NAME, value, keyName)
  },

  /**
   * @inheritdoc
   * 
   * @throws May reject on IndexedDB errors
   */
  async delete(keyName: string): Promise<void> {
    const db = await getCryptoDb()
    await db.delete(CRYPTO_STORE_NAME, keyName)
  },

  /**
   * @inheritdoc
   */
  async has(keyName: string): Promise<boolean> {
    const value = await indexedDbKeyStorage.get(keyName)
    return value !== undefined
  },
}
