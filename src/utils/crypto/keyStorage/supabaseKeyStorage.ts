// @deprecated Use userKeyService instead.
import { supabase } from '../../../lib/supabase'
import type { CryptoKeyStorage } from './types'

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

export const supabaseKeyStorage: CryptoKeyStorage = {
  /** @inheritdoc */
  async get(keyName: string): Promise<string | undefined> {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('user_keys')
      .select('key_value')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .maybeSingle()

    if (error) throw new Error(`Failed to get key "${keyName}": ${error.message}`)
    return data?.key_value ?? undefined
  },

  /** @inheritdoc */
  async set(keyName: string, value: string): Promise<void> {
    const userId = await getUserId()
    const { error } = await supabase.from('user_keys').upsert(
      {
        user_id: userId,
        key_name: keyName,
        key_value: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key_name' }
    )
    if (error) throw new Error(`Failed to set key "${keyName}": ${error.message}`)
  },

  /** @inheritdoc */
  async delete(keyName: string): Promise<void> {
    const userId = await getUserId()
    const { error } = await supabase.from('user_keys').delete().eq('user_id', userId).eq('key_name', keyName)
    if (error) throw new Error(`Failed to delete key "${keyName}": ${error.message}`)
  },

  /** @inheritdoc */
  async has(keyName: string): Promise<boolean> {
    const value = await supabaseKeyStorage.get(keyName)
    return value !== undefined
  },
}
