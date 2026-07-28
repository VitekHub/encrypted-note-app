import * as srpClient from 'secure-remote-password/client'
import { supabase } from '../../lib/supabase'
import { SRP_GROUP } from './srp/srpConfig'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Registers a new account using SRP-6a.
 *
 * The salt and verifier are derived locally from the username and password so
 * that neither the password nor any crackable hash of it ever leaves the
 * device. Only `(salt, verifier)` are sent to the `srp-register` Edge Function,
 * which creates the auth user, profile, and credential row server-side.
 *
 * @param username - Desired username (case-insensitive; stored lowercase)
 * @param password - User's plaintext password (never stored or transmitted)
 * @returns The newly created Supabase user ID
 * @throws If the username is taken or registration otherwise fails
 */
export async function register(username: string, password: string): Promise<string> {
  const normalizedUsername = username.toLowerCase()
  const salt = srpClient.generateSalt()
  const privateKey = srpClient.derivePrivateKey(salt, normalizedUsername, password)
  const verifier = srpClient.deriveVerifier(privateKey)

  const res = await fetch(`${SUPABASE_URL}/functions/v1/srp-register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: normalizedUsername, salt, verifier, group: SRP_GROUP }),
  })

  const body = (await res.json().catch(() => null)) as { userId?: string; error?: string } | null
  if (!res.ok) {
    throw new Error(body?.error || `Registration failed (${res.status})`)
  }
  if (!body?.userId) {
    throw new Error('Registration failed: no user id returned')
  }
  return body.userId
}

/**
 * Builds an "invalid credentials" error carrying the `invalid_credentials`
 * code so callers (the auth store lockout logic) treat it as a failed attempt.
 */
function invalidCredentialsError(): Error & { code: string } {
  const err = new Error('Invalid username or password.') as Error & { code: string }
  err.code = 'invalid_credentials'
  return err
}

/**
 * Logs an existing user in using the SRP-6a handshake.
 *
 * Two round trips: `srp-login-init` returns the salt and the server's public
 * ephemeral `B`; the client derives the shared session key and a proof `M1`,
 * which `srp-login-verify` checks before minting a Supabase session. The
 * server's proof `M2` is verified locally so the client also authenticates the
 * server. The password never leaves the device.
 *
 * @param username - Username to sign in with (case-insensitive)
 * @param password - User's plaintext password
 * @returns The authenticated Supabase user ID
 * @throws An error with `code: 'invalid_credentials'` on a bad username or
 *   password, or a generic error if the handshake or session setup fails
 */
export async function login(username: string, password: string): Promise<string> {
  const normalizedUsername = username.toLowerCase()

  const initRes = await fetch(`${SUPABASE_URL}/functions/v1/srp-login-init`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: normalizedUsername }),
  })
  const initBody = (await initRes.json().catch(() => null)) as {
    sessionId?: string
    salt?: string
    B?: string
    error?: string
  } | null
  if (initRes.status === 404 || initRes.status === 401) {
    throw invalidCredentialsError()
  }
  if (!initRes.ok || !initBody?.sessionId || !initBody.salt || !initBody.B) {
    throw new Error(initBody?.error || `Login failed (${initRes.status})`)
  }

  const clientEphemeral = srpClient.generateEphemeral()
  const privateKey = srpClient.derivePrivateKey(initBody.salt, normalizedUsername, password)

  let clientSession: srpClient.Session
  try {
    clientSession = srpClient.deriveSession(
      clientEphemeral.secret,
      initBody.B,
      initBody.salt,
      normalizedUsername,
      privateKey
    )
  } catch {
    throw invalidCredentialsError()
  }

  const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/srp-login-verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: initBody.sessionId,
      A: clientEphemeral.public,
      M1: clientSession.proof,
    }),
  })
  const verifyBody = (await verifyRes.json().catch(() => null)) as {
    M2?: string
    access_token?: string
    refresh_token?: string
    error?: string
  } | null
  if (verifyRes.status === 401) {
    throw invalidCredentialsError()
  }
  if (!verifyRes.ok || !verifyBody?.M2 || !verifyBody.access_token || !verifyBody.refresh_token) {
    throw new Error(verifyBody?.error || `Login failed (${verifyRes.status})`)
  }

  try {
    srpClient.verifySession(clientEphemeral.public, clientSession, verifyBody.M2)
  } catch {
    throw new Error('Server authentication failed.')
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: verifyBody.access_token,
    refresh_token: verifyBody.refresh_token,
  })
  if (error || !data.user) {
    throw new Error('Login failed: could not establish session.')
  }
  return data.user.id
}

/**
 * Changes the account password using SRP-6a.
 *
 * Runs a fresh SRP handshake to prove knowledge of the OLD password, derives a
 * brand-new salt and verifier from the NEW password, and asks the authenticated
 * `srp-change-password` Edge Function to swap the stored credential. Neither the
 * old nor the new password ever leaves the device.
 *
 * This only updates the authentication credential; re-encrypting the user's key
 * material is handled separately by `cryptoService.updatePassword`.
 *
 * @param username - The current account's username
 * @param oldPassword - The current password (proven, never transmitted)
 * @param newPassword - The desired new password (never transmitted)
 * @throws An error with `code: 'invalid_credentials'` if the old password is
 *   wrong, or a generic error if the handshake or update fails
 */
export async function changeSrpPassword(username: string, oldPassword: string, newPassword: string): Promise<void> {
  const normalizedUsername = username.toLowerCase()

  const initRes = await fetch(`${SUPABASE_URL}/functions/v1/srp-login-init`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: normalizedUsername }),
  })
  const initBody = (await initRes.json().catch(() => null)) as {
    sessionId?: string
    salt?: string
    B?: string
    error?: string
  } | null
  if (!initRes.ok || !initBody?.sessionId || !initBody.salt || !initBody.B) {
    throw new Error(initBody?.error || `Password change failed (${initRes.status})`)
  }

  const clientEphemeral = srpClient.generateEphemeral()
  const oldPrivateKey = srpClient.derivePrivateKey(initBody.salt, normalizedUsername, oldPassword)

  let clientSession: srpClient.Session
  try {
    clientSession = srpClient.deriveSession(
      clientEphemeral.secret,
      initBody.B,
      initBody.salt,
      normalizedUsername,
      oldPrivateKey
    )
  } catch {
    throw invalidCredentialsError()
  }

  const newSalt = srpClient.generateSalt()
  const newPrivateKey = srpClient.derivePrivateKey(newSalt, normalizedUsername, newPassword)
  const newVerifier = srpClient.deriveVerifier(newPrivateKey)

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Password change failed: no active session.')
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/srp-change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: initBody.sessionId,
      A: clientEphemeral.public,
      M1: clientSession.proof,
      salt: newSalt,
      verifier: newVerifier,
      group: SRP_GROUP,
    }),
  })
  const body = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
  if (res.status === 401) {
    throw invalidCredentialsError()
  }
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `Password change failed (${res.status})`)
  }
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
