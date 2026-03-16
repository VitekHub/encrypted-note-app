import { supabase } from '../../lib/supabase'
import { getUserId } from '../auth/usernameAuthService'

export interface UserKeysRow {
  rsa_public_key_spki: string | null
  rsa_private_key_encrypted: string | null
  rsa_key_version: string | null
  wrapped_master_key: string | null
}

/**
 * Upserts one or more fields in the `user_keys` row for the given user.
 *
 * Uses an upsert on `user_id` so that subsequent calls for the same user
 * replace the previous values rather than inserting a duplicate row.
 *
 * @param fields - Partial set of `UserKeysRow` fields to write
 * @returns Promise that resolves when the write completes
 * @throws If the database upsert fails
 */
async function upsertUserKeys(fields: Partial<UserKeysRow>): Promise<void> {
  const userId = await getUserId()
  const { error } = await supabase
    .from('user_keys')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(`Failed to upsert user_keys: ${error.message}`)
}

/**
 * Retrieves the RSA public key (SPKI format, base64-encoded) for the
 * authenticated user.
 *
 * @returns The stored public key string, or `null` if none exists
 * @throws If the database query fails
 */
export async function fetchRsaPublicKey(): Promise<string | null> {
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('user_keys')
    .select('rsa_public_key_spki')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch rsa_public_key_spki: ${error.message}`)
  return data?.rsa_public_key_spki ?? null
}

/**
 * Stores the RSA public key (SPKI format, base64-encoded) for the
 * authenticated user.
 *
 * @param value - Base64-encoded SPKI public key to store
 * @returns Promise that resolves when the write completes
 * @throws If the database upsert fails
 */
export async function saveRsaPublicKey(value: string): Promise<void> {
  await upsertUserKeys({ rsa_public_key_spki: value })
}

/**
 * Retrieves the encrypted RSA private key (base64-encoded ciphertext) for
 * the authenticated user.
 *
 * @returns The stored encrypted private key string, or `null` if none exists
 * @throws If the database query fails
 */
export async function fetchRsaPrivateKeyEncrypted(): Promise<string | null> {
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('user_keys')
    .select('rsa_private_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch rsa_private_key_encrypted: ${error.message}`)
  return data?.rsa_private_key_encrypted ?? null
}

/**
 * Stores the encrypted RSA private key (base64-encoded ciphertext) for
 * the authenticated user.
 *
 * @param value - Base64-encoded encrypted private key to store
 * @returns Promise that resolves when the write completes
 * @throws If the database upsert fails
 */
export async function saveRsaPrivateKeyEncrypted(value: string): Promise<void> {
  await upsertUserKeys({ rsa_private_key_encrypted: value })
}

/**
 * Retrieves the RSA key version string for the authenticated user.
 *
 * @returns The stored key version string (e.g. `"rsa_v1"`), or `null` if none exists
 * @throws If the database query fails
 */
export async function fetchRsaKeyVersion(): Promise<string | null> {
  const userId = await getUserId()
  const { data, error } = await supabase.from('user_keys').select('rsa_key_version').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Failed to fetch rsa_key_version: ${error.message}`)
  return data?.rsa_key_version ?? null
}

/**
 * Stores the RSA key version string for the authenticated user.
 *
 * @param value - Key version identifier to store (e.g. `"rsa_v1"`)
 * @returns Promise that resolves when the write completes
 * @throws If the database upsert fails
 */
export async function saveRsaKeyVersion(value: string): Promise<void> {
  await upsertUserKeys({ rsa_key_version: value })
}

/**
 * Retrieves the wrapped (RSA-encrypted) master key for the authenticated
 * user.
 *
 * @returns The stored wrapped master key string (base64-encoded), or `null` if none exists
 * @throws If the database query fails
 */
export async function fetchWrappedMasterKey(): Promise<string | null> {
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('user_keys')
    .select('wrapped_master_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch wrapped_master_key: ${error.message}`)
  return data?.wrapped_master_key ?? null
}

/**
 * Stores the wrapped (RSA-encrypted) master key for the authenticated user.
 *
 * @param value - Base64-encoded wrapped master key to store
 * @returns Promise that resolves when the write completes
 * @throws If the database upsert fails
 */
export async function saveWrappedMasterKey(value: string): Promise<void> {
  await upsertUserKeys({ wrapped_master_key: value })
}

/**
 * Deletes the entire `user_keys` row for the authenticated user.
 *
 * Used during account teardown to remove all stored cryptographic material.
 *
 * @returns Promise that resolves when the deletion completes
 * @throws If the database delete fails
 */
export async function deleteUserKeysRow(): Promise<void> {
  const userId = await getUserId()
  const { error } = await supabase.from('user_keys').delete().eq('user_id', userId)
  if (error) throw new Error(`Failed to delete user_keys row: ${error.message}`)
}
