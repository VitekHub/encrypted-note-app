import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  badRequest,
  clientIp,
  ERR,
  forbidden,
  guardPost,
  isRateLimited,
  json,
  serverError,
  tooManyRequests,
  unauthorized,
} from '../_shared/http.ts'
import { readJsonBody, str } from '../_shared/body.ts'
import { serviceClient, userClient } from '../_shared/supabase.ts'
import { consumeSession, isSessionExpired, loadCredential, SRP_GROUP, verifyProof } from '../_shared/srp.ts'

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
    const newSalt = str(body, 'salt')
    const newVerifier = str(body, 'verifier')
    const newGroup = str(body, 'group')
    if (!sessionId || !clientPublic || !clientProof || !newSalt || !newVerifier || !newGroup) {
      return badRequest()
    }
    if (newGroup !== SRP_GROUP) {
      return badRequest(ERR.UNSUPPORTED_GROUP)
    }

    // Identify the caller from their JWT.
    const {
      data: { user },
      error: userError,
    } = await userClient(req).auth.getUser()
    if (userError || !user) {
      return unauthorized(ERR.NOT_AUTHENTICATED)
    }

    const supabase = serviceClient()

    const loaded = await consumeSession(supabase, sessionId)
    if ('response' in loaded) return loaded.response
    const { session } = loaded

    if (session.user_id !== user.id) {
      return forbidden()
    }
    if (isSessionExpired(session)) {
      return unauthorized(ERR.SESSION_EXPIRED)
    }

    const cred = await loadCredential(supabase, session.user_id)
    if ('response' in cred) return cred.response

    // Prove knowledge of the OLD password against the stored verifier.
    const proof = verifyProof(session.server_b, clientPublic, cred.salt, cred.username, cred.verifier, clientProof)
    if (!proof) {
      return unauthorized()
    }

    const { error: updateError } = await supabase
      .from('srp_credentials')
      .update({
        salt: newSalt,
        verifier: newVerifier,
        srp_group: newGroup,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.user_id)
    if (updateError) {
      return serverError()
    }

    return json({ success: true })
  } catch (_err) {
    return serverError()
  }
})
