import * as srpClient from 'secure-remote-password/client'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Builds an "invalid credentials" error carrying the `invalid_credentials`
 * code so callers (the auth store lockout logic) treat it as a failed attempt.
 */
export function invalidCredentialsError(): Error & { code: string } {
  const err = new Error('Invalid username or password.') as Error & { code: string }
  err.code = 'invalid_credentials'
  return err
}

interface EdgeCallOptions {
  /** Bearer token for the Authorization header. Defaults to the anon key. */
  token?: string
  /** Response statuses that should surface as `invalidCredentialsError`. */
  invalidCredentialStatuses?: number[]
  /** Human-readable prefix for the generic failure message, e.g. `Login`. */
  failureLabel: string
}

/**
 * POSTs a JSON body to an Edge Function and returns the parsed response.
 *
 * Centralizes the shared request shape (auth header, content type, JSON
 * parsing) and error handling: listed statuses become an
 * `invalid_credentials` error, any other non-2xx becomes a generic error
 * using the server's `error` message when present.
 */
export async function callEdgeFunction<T>(slug: string, payload: unknown, opts: EdgeCallOptions): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token ?? SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null

  if (opts.invalidCredentialStatuses?.includes(res.status)) {
    throw invalidCredentialsError()
  }
  if (!res.ok) {
    throw new Error(body?.error || `${opts.failureLabel} failed (${res.status})`)
  }
  return (body ?? {}) as T
}

export interface SrpInit {
  sessionId: string
  salt: string
  B: string
}

/**
 * Runs the first SRP round trip against `srp-login-init`, returning the
 * server's salt and public ephemeral for the given username.
 */
export async function srpLoginInit(
  username: string,
  opts: { failureLabel: string; invalidCredentialStatuses?: number[] }
): Promise<SrpInit> {
  const body = await callEdgeFunction<{ sessionId?: string; salt?: string; B?: string }>(
    'srp-login-init',
    { username },
    opts
  )
  if (!body.sessionId || !body.salt || !body.B) {
    throw new Error(`${opts.failureLabel} failed: incomplete server response`)
  }
  return { sessionId: body.sessionId, salt: body.salt, B: body.B }
}

/**
 * Derives the client SRP session, mapping a derivation failure (typically a
 * bad password) to an `invalid_credentials` error.
 */
export function deriveClientSession(
  ephemeralSecret: string,
  serverPublicEphemeral: string,
  salt: string,
  username: string,
  privateKey: string
): srpClient.Session {
  try {
    return srpClient.deriveSession(ephemeralSecret, serverPublicEphemeral, salt, username, privateKey)
  } catch {
    throw invalidCredentialsError()
  }
}
