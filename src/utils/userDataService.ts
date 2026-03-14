import { supabase } from '../lib/supabase'

/**
 * Resolves the authenticated user's Supabase ID from the active session.
 *
 * @returns The current user's UUID
 * @throws If there is no active Supabase session
 */
async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('No active Supabase session')
  return session.user.id
}

/**
 * Retrieves the value stored under the given key for the authenticated user.
 *
 * @param dataKey - Unique key identifying the data entry (e.g. `"encrypted_note"`)
 * @returns The stored string value, or `null` if no entry exists for this key
 * @throws If the database query fails
 */
export async function getUserData(dataKey: string): Promise<string | null> {
  const userId = await getUserId()
  const { data, error } = await supabase
    .from('user_data')
    .select('data_value')
    .eq('user_id', userId)
    .eq('data_key', dataKey)
    .maybeSingle()

  if (error) throw new Error(`Failed to get data "${dataKey}": ${error.message}`)
  return data?.data_value ?? null
}

/**
 * Creates or overwrites the value stored under the given key for the
 * authenticated user.
 *
 * Uses an upsert on `(user_id, data_key)` so that subsequent calls for the
 * same key replace the previous value rather than inserting a duplicate.
 *
 * @param dataKey - Unique key identifying the data entry
 * @param dataValue - String value to store (typically base64-encoded ciphertext)
 * @returns Promise that resolves when the write completes
 * @throws If the database upsert fails
 */
export async function setUserData(dataKey: string, dataValue: string): Promise<void> {
  const userId = await getUserId()
  const { error } = await supabase.from('user_data').upsert(
    {
      user_id: userId,
      data_key: dataKey,
      data_value: dataValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,data_key' }
  )
  if (error) throw new Error(`Failed to set data "${dataKey}": ${error.message}`)
}

/**
 * Removes the entry stored under the given key for the authenticated user.
 *
 * @param dataKey - Unique key identifying the data entry to delete
 * @returns Promise that resolves when the deletion completes
 * @throws If the database delete fails
 */
export async function deleteUserData(dataKey: string): Promise<void> {
  const userId = await getUserId()
  const { error } = await supabase.from('user_data').delete().eq('user_id', userId).eq('data_key', dataKey)
  if (error) throw new Error(`Failed to delete data "${dataKey}": ${error.message}`)
}

/**
 * Checks whether any value is stored under the given key for the authenticated
 * user.
 *
 * @param dataKey - Unique key identifying the data entry to check
 * @returns `true` if an entry exists, `false` otherwise
 */
export async function hasUserData(dataKey: string): Promise<boolean> {
  const value = await getUserData(dataKey)
  return value !== null
}
