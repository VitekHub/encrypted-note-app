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
import { consumeHandshake, isHandshakeExpired, loadCredential, USERNAME_DOMAIN, verifyProof } from '../_shared/srp.ts'

type VerifyFields = { handshakeId: string; clientPublic: string; clientProof: string }

/** Parses and validates the three required SRP verify fields. */
async function parseVerifyRequest(req: Request): Promise<{ errorResponse: Response } | VerifyFields> {
  const body = await readJsonBody(req)
  const handshakeId = str(body, 'handshakeId')
  const clientPublic = str(body, 'A')
  const clientProof = str(body, 'M1')
  if (!handshakeId || !clientPublic || !clientProof) {
    return { errorResponse: badRequest(ERR.INVALID_CREDENTIALS) }
  }
  return { handshakeId, clientPublic, clientProof }
}

type SessionTokens = { access_token: string; refresh_token: string }

/**
 * Mints Supabase access + refresh tokens for the user via a one-shot magic-link
 * flow: generate a link, extract its hashed token, and verify it immediately.
 */
async function mintSessionTokens(
  supabase: SupabaseClient,
  username: string
): Promise<{ errorResponse: Response } | SessionTokens> {
  const email = `${username}@${USERNAME_DOMAIN}`
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return { errorResponse: serverError() }
  }

  const { data: verified, error: otpError } = await anonClient().auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (otpError || !verified?.session) {
    return { errorResponse: serverError() }
  }

  return { access_token: verified.session.access_token, refresh_token: verified.session.refresh_token }
}

async function handleLoginVerify(req: Request): Promise<Response> {
  const parsed = await parseVerifyRequest(req)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { handshakeId, clientPublic, clientProof } = parsed

  const supabase = serviceClient()

  const loaded = await consumeHandshake(supabase, handshakeId)
  if ('errorResponse' in loaded) return loaded.errorResponse
  const { handshake } = loaded

  if (isHandshakeExpired(handshake)) {
    return unauthorized(ERR.HANDSHAKE_EXPIRED)
  }

  const cred = await loadCredential(supabase, handshake.user_id)
  if ('errorResponse' in cred) return cred.errorResponse

  const proof = verifyProof(handshake.server_b, clientPublic, cred.salt, cred.username, cred.verifier, clientProof)
  if (!proof) {
    return unauthorized()
  }

  const tokens = await mintSessionTokens(supabase, cred.username)
  if ('errorResponse' in tokens) return tokens.errorResponse

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
