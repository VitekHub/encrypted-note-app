import { argon2id } from 'hash-wasm'
import { supabase } from '../../lib/supabase'

const USERNAME_DOMAIN = 'ciphernote.local'

const AUTH_TOKEN_ARGON2_PARAMS = {
  iterations: 1,
  memorySize: 65536,
  parallelism: 1,
  hashLength: 32,
} as const

/**
 * Converts a plain username into a synthetic e-mail address accepted by
 * Supabase Auth.
 *
 * @param username - Raw username (will be lower-cased)
 * @returns Synthetic e-mail in the form `<username>@ciphernote.local`
 */
function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@${USERNAME_DOMAIN}`
}

/**
 * Derives a deterministic auth token from the username and password using Argon2id.
 *
 * The token is a hex-encoded 32-byte Argon2id hash and is used as the Supabase
 * Auth password so that the real user password never leaves the client.
 *
 * The salt is derived deterministically from the normalized username
 * (`<username>@ciphernote.local`), making the output stable across sessions
 * without requiring salt storage.
 *
 * Params: 1 iteration, 64 MB memory, parallelism 1 (low-cost; the heavy KDF
 * work happens separately when deriving the master encryption key).
 *
 * @param username - Raw username (will be lower-cased before hashing)
 * @param password - User's plaintext password
 * @returns 64-char lowercase hex string to use as the Supabase Auth password
 */
export async function deriveAuthToken(username: string, password: string): Promise<string> {
  const normalized = username.toLowerCase()
  const saltStr = `${normalized}@${USERNAME_DOMAIN}`
  const encoder = new TextEncoder()
  const saltBytes = encoder.encode(saltStr)
  const salt =
    saltBytes.length >= 8 ? saltBytes : new Uint8Array([...saltBytes, ...new Uint8Array(8 - saltBytes.length)])
  return argon2id({
    password,
    salt,
    ...AUTH_TOKEN_ARGON2_PARAMS,
    outputType: 'hex',
  })
}

/**
 * Checks whether a username is available for registration.
 *
 * Calls the `check_username_available` Supabase RPC which queries the
 * `profiles` table without exposing other user data.
 *
 * @param username - Username to check (case-insensitive)
 * @returns `true` if the username is not yet taken, `false` otherwise
 * @throws If the RPC call fails
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_username_available', {
    username_input: username,
  })
  if (error) throw new Error(`Username check failed: ${error.message}`)
  return data as boolean
}

/**
 * Creates a new account for the given username and password.
 *
 * Registers the user with Supabase Auth using a synthetic e-mail and a
 * derived auth token, then inserts a row into the `profiles` table to
 * associate the Supabase user ID with the chosen username.
 *
 * @param username - Desired username (3–32 characters, letters/numbers/underscores)
 * @param password - User's plaintext password (never stored or transmitted)
 * @returns The newly created Supabase user ID
 * @throws If the username is already taken, if Auth sign-up fails, or if the
 *   profile row cannot be inserted
 */
export async function signUp(username: string, password: string): Promise<string> {
  const normalizedUsername = username.toLowerCase()
  const email = usernameToEmail(normalizedUsername)
  const authToken = await deriveAuthToken(normalizedUsername, password)

  const { data, error } = await supabase.auth.signUp({
    email,
    password: authToken,
  })

  if (error) {
    if (error.message.includes('already registered')) {
      throw new Error('Username already taken.')
    }
    throw new Error(`Sign up failed: ${error.message}`)
  }

  if (!data.user) throw new Error('Sign up failed: no user returned')

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    username: normalizedUsername,
  })

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`)
  }

  return data.user.id
}

/**
 * Signs an existing user in with their username and password.
 *
 * Derives the same auth token used during registration and calls
 * `signInWithPassword` with the synthetic e-mail.
 *
 * @param username - Username to sign in with (case-insensitive)
 * @param password - User's plaintext password
 * @returns The authenticated Supabase user ID
 * @throws If the credentials are incorrect or if the Auth call fails
 */
export async function signIn(username: string, password: string): Promise<string> {
  const normalizedUsername = username.toLowerCase()
  const email = usernameToEmail(normalizedUsername)
  const authToken = await deriveAuthToken(normalizedUsername, password)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: authToken,
  })

  if (error) {
    if ((error as { code?: string })?.code?.includes('invalid_credentials')) {
      throw error
    }
    throw new Error(`Sign in failed: ${error.message}`)
  }

  if (!data.user) throw new Error('Sign in failed: no user returned')
  return data.user.id
}

/**
 * Signs the current user out and invalidates their Supabase session.
 *
 * @throws If the Supabase sign-out call fails
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`Sign out failed: ${error.message}`)
}

/**
 * Permanently deletes the authenticated user's account and all associated
 * data by calling the `delete_own_account` Supabase RPC.
 *
 * @throws If the user is not authenticated or if the RPC call fails
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw new Error(`Failed to delete account: ${error.message}`)
}

/**
 * Resolves the authenticated user's Supabase ID from the active session.
 *
 * @returns The current user's UUID
 * @throws If there is no active Supabase session
 */
export async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('No active Supabase session')
  return session.user.id
}

/**
 * Retrieves the current Supabase session and resolves it to the application's
 * user identity.
 *
 * @returns An object containing `userId` and `username`, or `null` when there
 *   is no active session or the profile row cannot be found
 */
export async function getCurrentSession(): Promise<{ userId: string; username: string } | null> {
  try {
    const userId = await getUserId()
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
    if (!profile) return null
    return { userId, username: profile.username }
  } catch {
    return null
  }
}

/**
 * Validates a username against the application's naming rules.
 *
 * Rules enforced:
 * - Minimum 3 characters
 * - Maximum 32 characters
 * - Only ASCII letters, digits, and underscores
 *
 * @param username - Username string to validate
 * @returns Array of human-readable error messages; empty when the username is valid
 */
export function validateUsername(username: string): string[] {
  const errors: string[] = []
  if (username.length < 3) errors.push('Minimum 3 characters')
  if (username.length > 32) errors.push('Maximum 32 characters')
  if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.push('Only letters, numbers, and underscores')
  return errors
}
