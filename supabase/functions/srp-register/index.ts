import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
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

function randomPassword(): string {
  const bytes = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    const body = await readJsonBody(req)
    const username = str(body, 'username').toLowerCase()
    const salt = str(body, 'salt')
    const verifier = str(body, 'verifier')
    const group = str(body, 'group')

    if (!isValidUsername(username)) {
      return badRequest(ERR.INVALID_USERNAME)
    }
    if (!salt || !verifier) {
      return badRequest(ERR.MISSING_CREDENTIALS)
    }
    if (group !== SRP_GROUP) {
      return badRequest(ERR.UNSUPPORTED_GROUP)
    }

    const supabase = serviceClient()

    const { data: existing, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (lookupError) {
      return serverError()
    }
    if (existing) {
      return conflict()
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: `${username}@${USERNAME_DOMAIN}`,
      password: randomPassword(),
      email_confirm: true,
    })
    if (createError || !created?.user) {
      const msg = createError?.message ?? ''
      if (msg.toLowerCase().includes('already')) {
        return conflict()
      }
      return serverError()
    }

    const userId = created.user.id

    const { error: profileError } = await supabase.from('profiles').insert({ id: userId, username })
    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      const taken = profileError.message.toLowerCase().includes('duplicate')
      return taken ? conflict() : serverError()
    }

    const { error: credError } = await supabase
      .from('srp_credentials')
      .insert({ user_id: userId, salt, verifier, srp_group: group })
    if (credError) {
      await supabase.auth.admin.deleteUser(userId)
      return serverError()
    }

    return json({ userId })
  } catch (_err) {
    return serverError()
  }
})
