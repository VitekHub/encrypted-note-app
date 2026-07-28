import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  badRequest,
  clientIp,
  conflict,
  ERR,
  guardPost,
  isRateLimited,
  json,
  serverError,
  tooManyRequests,
} from '../_shared/http.ts'
import { readJsonBody, str } from '../_shared/body.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { isValidUsername, SRP_GROUP, USERNAME_DOMAIN } from '../_shared/srp.ts'

type RegisterFields = { username: string; salt: string; verifier: string; group: string }

/** A failure that the caller should translate into a 409 conflict. */
type Conflict = { conflict: true }

function randomPassword(): string {
  const bytes = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/** Parses and validates the four required SRP register fields. */
async function parseRegisterRequest(req: Request): Promise<{ response: Response } | RegisterFields> {
  const body = await readJsonBody(req)
  const username = str(body, 'username').toLowerCase()
  const salt = str(body, 'salt')
  const verifier = str(body, 'verifier')
  const group = str(body, 'group')

  if (!isValidUsername(username)) {
    return { response: badRequest(ERR.INVALID_USERNAME) }
  }
  if (!salt || !verifier) {
    return { response: badRequest(ERR.MISSING_CREDENTIALS) }
  }
  if (group !== SRP_GROUP) {
    return { response: badRequest(ERR.UNSUPPORTED_GROUP) }
  }
  return { username, salt, verifier, group }
}

/** Returns true if a profile with this username already exists. */
async function usernameTaken(
  supabase: SupabaseClient,
  username: string
): Promise<{ response: Response } | Conflict | { taken: false }> {
  const { data: existing, error } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
  if (error) {
    return { response: serverError() }
  }
  return existing ? { conflict: true } : { taken: false }
}

/** Creates the Supabase auth user with a random placeholder password. */
async function createAuthUser(
  supabase: SupabaseClient,
  username: string
): Promise<{ response: Response } | Conflict | { userId: string }> {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: `${username}@${USERNAME_DOMAIN}`,
    password: randomPassword(),
    email_confirm: true,
  })
  if (error || !created?.user) {
    const msg = error?.message ?? ''
    if (msg.toLowerCase().includes('already')) {
      return { conflict: true }
    }
    return { response: serverError() }
  }
  return { userId: created.user.id }
}

/**
 * Inserts the profile row. On failure rolls back the auth user so we never
 * leave an orphaned account behind.
 */
async function insertProfile(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<{ response: Response } | Conflict | { ok: true }> {
  const { error } = await supabase.from('profiles').insert({ id: userId, username })
  if (error) {
    await supabase.auth.admin.deleteUser(userId)
    const taken = error.message.toLowerCase().includes('duplicate')
    return taken ? { conflict: true } : { response: serverError() }
  }
  return { ok: true }
}

/**
 * Stores the SRP credential. On failure rolls back both the profile row and
 * the auth user.
 */
async function insertCredential(
  supabase: SupabaseClient,
  userId: string,
  fields: RegisterFields
): Promise<{ response: Response } | { ok: true }> {
  const { error } = await supabase
    .from('srp_credentials')
    .insert({ user_id: userId, salt: fields.salt, verifier: fields.verifier, srp_group: fields.group })
  if (error) {
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.admin.deleteUser(userId)
    return { response: serverError() }
  }
  return { ok: true }
}

async function handleRegister(req: Request): Promise<Response> {
  const parsed = await parseRegisterRequest(req)
  if ('response' in parsed) return parsed.response

  const supabase = serviceClient()

  const taken = await usernameTaken(supabase, parsed.username)
  if ('response' in taken) return taken.response
  if ('conflict' in taken) return conflict()

  const authUser = await createAuthUser(supabase, parsed.username)
  if ('response' in authUser) return authUser.response
  if ('conflict' in authUser) return conflict()

  const profile = await insertProfile(supabase, authUser.userId, parsed.username)
  if ('response' in profile) return profile.response
  if ('conflict' in profile) return conflict()

  const cred = await insertCredential(supabase, authUser.userId, parsed)
  if ('response' in cred) return cred.response

  return json({ userId: authUser.userId })
}

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    return await handleRegister(req)
  } catch (_err) {
    return serverError()
  }
})
