import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import * as srpServer from 'npm:secure-remote-password@0.3.1/server'
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { badRequest, clientIp, guardPost, isRateLimited, json, serverError, tooManyRequests } from '../_shared/http.ts'
import { readJsonBody, str } from '../_shared/body.ts'
import { serviceClient, serviceKey } from '../_shared/supabase.ts'

const SESSION_TTL_MS = 2 * 60 * 1000

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Credentials = { salt: string; verifier: string }

/** Loads the stored SRP salt + verifier for a user. Returns null when none exist. */
async function loadCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<{ response: Response } | Credentials | null> {
  const { data: cred, error } = await supabase
    .from('srp_credentials')
    .select('salt, verifier')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    return { response: serverError() }
  }
  if (!cred) {
    return null
  }
  return { salt: cred.salt, verifier: cred.verifier }
}

/**
 * Resolves a username to its user id + credentials. Returns null when the
 * account does not exist, so the caller can issue an indistinguishable decoy
 * response instead of revealing whether the user is real.
 */
async function resolveAccount(
  supabase: SupabaseClient,
  username: string
): Promise<{ response: Response } | { userId: string; credentials: Credentials } | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (profileError) {
    return { response: serverError() }
  }
  if (!profile) {
    return null
  }
  const cred = await loadCredentials(supabase, profile.id)
  if (cred && 'response' in cred) {
    return cred
  }
  if (!cred) {
    return null
  }
  return { userId: profile.id, credentials: cred }
}

/**
 * Builds a response that is indistinguishable from a real user's, using a
 * deterministic decoy salt + a fresh ephemeral B. The subsequent verify step
 * then fails exactly like a wrong password would, so probes cannot tell real
 * users from nonexistent ones.
 */
async function decoyResponse(username: string): Promise<Response> {
  const decoySalt = await hmacHex(serviceKey, `srp-decoy-salt:${username}`)
  const decoyVerifier = await hmacHex(serviceKey, `srp-decoy-verifier:${username}`)
  const decoyEphemeral = srpServer.generateEphemeral(decoyVerifier)
  return json({ sessionId: crypto.randomUUID(), salt: decoySalt, B: decoyEphemeral.public })
}

/** Persists a one-time SRP handshake session and returns its id. */
async function createSession(
  supabase: SupabaseClient,
  userId: string,
  ephemeral: { secret: string; public: string }
): Promise<{ response: Response } | { sessionId: string }> {
  const { data: session, error } = await supabase
    .from('srp_sessions')
    .insert({
      user_id: userId,
      server_b: ephemeral.secret,
      public_b: ephemeral.public,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .select('id')
    .single()
  if (error || !session) {
    return { response: serverError() }
  }
  return { sessionId: session.id }
}

async function handleLoginInit(req: Request): Promise<Response> {
  const body = await readJsonBody(req)
  const username = str(body, 'username').toLowerCase()
  if (!username) {
    return badRequest()
  }

  const supabase = serviceClient()

  await supabase.from('srp_sessions').delete().lt('expires_at', new Date().toISOString())

  const account = await resolveAccount(supabase, username)
  if (account && 'response' in account) return account.response
  if (!account) {
    return decoyResponse(username)
  }

  const { userId, credentials } = account
  const ephemeral = srpServer.generateEphemeral(credentials.verifier)

  const session = await createSession(supabase, userId, ephemeral)
  if ('response' in session) return session.response

  return json({ sessionId: session.sessionId, salt: credentials.salt, B: ephemeral.public })
}

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    return await handleLoginInit(req)
  } catch (_err) {
    return serverError()
  }
})
