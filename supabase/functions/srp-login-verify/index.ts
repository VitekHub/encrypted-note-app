import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  badRequest,
  clientIp,
  ERR,
  guardPost,
  isRateLimited,
  json,
  serverError,
  tooManyRequests,
  unauthorized,
} from '../_shared/http.ts'
import { readJsonBody, str } from '../_shared/body.ts'
import { anonClient, serviceClient } from '../_shared/supabase.ts'
import { consumeSession, isSessionExpired, loadCredential, USERNAME_DOMAIN, verifyProof } from '../_shared/srp.ts'

type VerifyFields = { sessionId: string; clientPublic: string; clientProof: string }

/** Parses and validates the three required SRP verify fields. */
async function parseVerifyRequest(req: Request): Promise<{ response: Response } | VerifyFields> {
  const body = await readJsonBody(req)
  const sessionId = str(body, 'sessionId')
  const clientPublic = str(body, 'A')
  const clientProof = str(body, 'M1')
  if (!sessionId || !clientPublic || !clientProof) {
    return { response: badRequest(ERR.INVALID_CREDENTIALS) }
  }
  return { sessionId, clientPublic, clientProof }
}

type SessionTokens = { access_token: string; refresh_token: string }

/**
 * Mints Supabase access + refresh tokens for the user via a one-shot magic-link
 * flow: generate a link, extract its hashed token, and verify it immediately.
 */
async function mintSessionTokens(
  supabase: SupabaseClient,
  username: string
): Promise<{ response: Response } | SessionTokens> {
  const email = `${username}@${USERNAME_DOMAIN}`
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return { response: serverError() }
  }

  const { data: verified, error: otpError } = await anonClient().auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (otpError || !verified?.session) {
    return { response: serverError() }
  }

  return { access_token: verified.session.access_token, refresh_token: verified.session.refresh_token }
}

async function handleLoginVerify(req: Request): Promise<Response> {
  const parsed = await parseVerifyRequest(req)
  if ('response' in parsed) return parsed.response
  const { sessionId, clientPublic, clientProof } = parsed

  const supabase = serviceClient()

  const loaded = await consumeSession(supabase, sessionId)
  if ('response' in loaded) return loaded.response
  const { session } = loaded

  if (isSessionExpired(session)) {
    return unauthorized(ERR.SESSION_EXPIRED)
  }

  const cred = await loadCredential(supabase, session.user_id)
  if ('response' in cred) return cred.response

  const proof = verifyProof(session.server_b, clientPublic, cred.salt, cred.username, cred.verifier, clientProof)
  if (!proof) {
    return unauthorized()
  }

  const tokens = await mintSessionTokens(supabase, cred.username)
  if ('response' in tokens) return tokens.response

  return json({
    M2: proof.proof,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })
}

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    return await handleLoginVerify(req)
  } catch (_err) {
    return serverError()
  }
})
