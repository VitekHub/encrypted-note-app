import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2'
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

type ChangePasswordFields = {
  sessionId: string
  clientPublic: string
  clientProof: string
  newSalt: string
  newVerifier: string
  newGroup: string
}

/** Parses and validates the six required change-password fields. */
async function parseChangePasswordRequest(req: Request): Promise<{ response: Response } | ChangePasswordFields> {
  const body = await readJsonBody(req)
  const sessionId = str(body, 'sessionId')
  const clientPublic = str(body, 'A')
  const clientProof = str(body, 'M1')
  const newSalt = str(body, 'salt')
  const newVerifier = str(body, 'verifier')
  const newGroup = str(body, 'group')

  if (!sessionId || !clientPublic || !clientProof || !newSalt || !newVerifier || !newGroup) {
    return { response: badRequest() }
  }
  if (newGroup !== SRP_GROUP) {
    return { response: badRequest(ERR.UNSUPPORTED_GROUP) }
  }
  return { sessionId, clientPublic, clientProof, newSalt, newVerifier, newGroup }
}

/** Identifies the caller from their JWT. */
async function identifyUser(req: Request): Promise<{ response: Response } | { userId: string }> {
  const {
    data: { user },
    error: userError,
  } = await userClient(req).auth.getUser()
  if (userError || !user) {
    return { response: unauthorized(ERR.NOT_AUTHENTICATED) }
  }
  return { userId: user.id }
}

/** Overwrites the stored SRP credential with the new salt/verifier/group. */
async function updateCredential(
  supabase: SupabaseClient,
  userId: string,
  fields: ChangePasswordFields
): Promise<{ response: Response } | { ok: true }> {
  const { error } = await supabase
    .from('srp_credentials')
    .update({
      salt: fields.newSalt,
      verifier: fields.newVerifier,
      srp_group: fields.newGroup,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) {
    return { response: serverError() }
  }
  return { ok: true }
}

async function handleChangePassword(req: Request): Promise<Response> {
  const parsed = await parseChangePasswordRequest(req)
  if ('response' in parsed) return parsed.response

  const caller = await identifyUser(req)
  if ('response' in caller) return caller.response

  const supabase = serviceClient()

  const loaded = await consumeSession(supabase, parsed.sessionId)
  if ('response' in loaded) return loaded.response
  const { session } = loaded

  if (session.user_id !== caller.userId) {
    return forbidden()
  }
  if (isSessionExpired(session)) {
    return unauthorized(ERR.SESSION_EXPIRED)
  }

  const cred = await loadCredential(supabase, session.user_id)
  if ('response' in cred) return cred.response

  const proof = verifyProof(
    session.server_b,
    parsed.clientPublic,
    cred.salt,
    cred.username,
    cred.verifier,
    parsed.clientProof
  )
  if (!proof) {
    return unauthorized()
  }

  const updated = await updateCredential(supabase, session.user_id, parsed)
  if ('response' in updated) return updated.response

  return json({ success: true })
}

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    return await handleChangePassword(req)
  } catch (_err) {
    return serverError()
  }
})
