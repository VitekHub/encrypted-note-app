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
import { consumeHandshake, isHandshakeExpired, loadCredential, SRP_GROUP, verifyProof } from '../_shared/srp.ts'

type ChangePasswordFields = {
  handshakeId: string
  clientPublic: string
  clientProof: string
  newSalt: string
  newVerifier: string
  newGroup: string
}

/** Parses and validates the six required change-password fields. */
async function parseChangePasswordRequest(req: Request): Promise<{ errorResponse: Response } | ChangePasswordFields> {
  const body = await readJsonBody(req)
  const handshakeId = str(body, 'handshakeId')
  const clientPublic = str(body, 'A')
  const clientProof = str(body, 'M1')
  const newSalt = str(body, 'salt')
  const newVerifier = str(body, 'verifier')
  const newGroup = str(body, 'group')

  if (!handshakeId || !clientPublic || !clientProof || !newSalt || !newVerifier || !newGroup) {
    return { errorResponse: badRequest() }
  }
  if (newGroup !== SRP_GROUP) {
    return { errorResponse: badRequest(ERR.UNSUPPORTED_GROUP) }
  }
  return { handshakeId, clientPublic, clientProof, newSalt, newVerifier, newGroup }
}

/** Identifies the caller from their JWT. */
async function identifyUser(req: Request): Promise<{ errorResponse: Response } | { userId: string }> {
  const {
    data: { user },
    error: userError,
  } = await userClient(req).auth.getUser()
  if (userError || !user) {
    return { errorResponse: unauthorized(ERR.NOT_AUTHENTICATED) }
  }
  return { userId: user.id }
}

/** Overwrites the stored SRP credential with the new salt/verifier/group. */
async function updateCredential(
  supabase: SupabaseClient,
  userId: string,
  fields: ChangePasswordFields
): Promise<{ errorResponse: Response } | { ok: true }> {
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
    return { errorResponse: serverError() }
  }
  return { ok: true }
}

async function handleChangePassword(req: Request): Promise<Response> {
  const parsed = await parseChangePasswordRequest(req)
  if ('errorResponse' in parsed) return parsed.errorResponse

  const caller = await identifyUser(req)
  if ('errorResponse' in caller) return caller.errorResponse

  const supabase = serviceClient()

  const loaded = await consumeHandshake(supabase, parsed.handshakeId)
  if ('errorResponse' in loaded) return loaded.errorResponse
  const { handshake } = loaded

  if (handshake.user_id !== caller.userId) {
    return forbidden()
  }
  if (isHandshakeExpired(handshake)) {
    return unauthorized(ERR.HANDSHAKE_EXPIRED)
  }

  const cred = await loadCredential(supabase, handshake.user_id)
  if ('errorResponse' in cred) return cred.errorResponse

  const proof = verifyProof(
    handshake.server_b,
    parsed.clientPublic,
    cred.salt,
    cred.username,
    cred.verifier,
    parsed.clientProof
  )
  if (!proof) {
    return unauthorized()
  }

  const updated = await updateCredential(supabase, handshake.user_id, parsed)
  if ('errorResponse' in updated) return updated.errorResponse

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
