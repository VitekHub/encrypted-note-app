import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
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

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    const body = await readJsonBody(req)
    const sessionId = str(body, 'sessionId')
    const clientPublic = str(body, 'A')
    const clientProof = str(body, 'M1')
    if (!sessionId || !clientPublic || !clientProof) {
      return badRequest(ERR.INVALID_CREDENTIALS)
    }

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

    const email = `${cred.username}@${USERNAME_DOMAIN}`
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) {
      return serverError()
    }

    const { data: verified, error: otpError } = await anonClient().auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (otpError || !verified?.session) {
      return serverError()
    }

    return json({
      M2: proof.proof,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    })
  } catch (_err) {
    return serverError()
  }
})
