import * as srpServer from 'npm:secure-remote-password@0.3.1/server'
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { serverError, unauthorized } from './http.ts'

export const USERNAME_DOMAIN = 'ciphernote.local'
export const SRP_GROUP = 'RFC5054-2048'

const USERNAME_RE = /^[a-zA-Z0-9_]+$/

export function isValidUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 32 && USERNAME_RE.test(username)
}

export interface LoadedSession {
  id: string
  user_id: string
  server_b: string
  expires_at: string
}

/**
 * Loads a single-use SRP handshake session and deletes it regardless of
 * outcome. Returns the row for the caller to authorize/verify, or a ready
 * Response when the session is missing or the lookup failed.
 */
export async function consumeSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ session: LoadedSession } | { response: Response }> {
  const { data: session, error } = await supabase
    .from('srp_sessions')
    .select('id, user_id, server_b, expires_at')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) {
    return { response: serverError() }
  }
  if (!session) {
    return { response: unauthorized() }
  }
  await supabase.from('srp_sessions').delete().eq('id', session.id)
  return { session: session as LoadedSession }
}

export function isSessionExpired(session: LoadedSession): boolean {
  return new Date(session.expires_at).getTime() < Date.now()
}

/** Fetches the stored credential and username for a user in one step. */
export async function loadCredential(
  supabase: SupabaseClient,
  userId: string
): Promise<{ salt: string; verifier: string; username: string } | { response: Response }> {
  // Both lookups are keyed by userId, so run them concurrently.
  const [credRes, profileRes] = await Promise.all([
    supabase.from('srp_credentials').select('salt, verifier').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
  ])
  if (credRes.error || profileRes.error) {
    return { response: serverError() }
  }
  // Missing credential (e.g. aborted signup) — surface as invalid credentials,
  // not a server error, so a half-provisioned account gets a clean 401.
  if (!credRes.data || !profileRes.data) {
    return { response: unauthorized() }
  }
  return { salt: credRes.data.salt, verifier: credRes.data.verifier, username: profileRes.data.username }
}

/**
 * Verifies the client's SRP proof against the stored verifier. Returns the
 * server proof (M2) on success, or null when the proof does not match.
 */
export function verifyProof(
  serverSecret: string,
  clientPublic: string,
  salt: string,
  username: string,
  verifier: string,
  clientProof: string
): { proof: string } | null {
  try {
    const session = srpServer.deriveSession(serverSecret, clientPublic, salt, username, verifier, clientProof)
    return { proof: session.proof }
  } catch (_e) {
    return null
  }
}
