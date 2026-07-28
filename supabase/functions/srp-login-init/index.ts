import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import * as srpServer from 'npm:secure-remote-password@0.3.1/server'
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

Deno.serve(async (req: Request) => {
  const guard = guardPost(req)
  if (guard) return guard

  if (isRateLimited(clientIp(req))) {
    return tooManyRequests()
  }

  try {
    const body = await readJsonBody(req)
    const username = str(body, 'username').toLowerCase()
    if (!username) {
      return badRequest()
    }

    const supabase = serviceClient()

    await supabase.from('srp_sessions').delete().lt('expires_at', new Date().toISOString())

    // Look up the account. For a missing account we do NOT reveal that fact:
    // we fall through to a deterministic decoy salt + a fresh ephemeral B so
    // the response is indistinguishable from a real user. The subsequent
    // verify step then fails exactly like a wrong password would.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (profileError) {
      return serverError()
    }

    let realSalt: string | null = null
    let realVerifier: string | null = null
    if (profile) {
      const { data: cred, error: credError } = await supabase
        .from('srp_credentials')
        .select('salt, verifier')
        .eq('user_id', profile.id)
        .maybeSingle()
      if (credError) {
        return serverError()
      }
      if (cred) {
        realSalt = cred.salt
        realVerifier = cred.verifier
      }
    }

    if (!profile || !realSalt || !realVerifier) {
      const decoySalt = await hmacHex(serviceKey, `srp-decoy-salt:${username}`)
      const decoyVerifier = await hmacHex(serviceKey, `srp-decoy-verifier:${username}`)
      const decoyEphemeral = srpServer.generateEphemeral(decoyVerifier)
      return json({ sessionId: crypto.randomUUID(), salt: decoySalt, B: decoyEphemeral.public })
    }

    const ephemeral = srpServer.generateEphemeral(realVerifier)

    const { data: session, error: insertError } = await supabase
      .from('srp_sessions')
      .insert({
        user_id: profile.id,
        server_b: ephemeral.secret,
        public_b: ephemeral.public,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .select('id')
      .single()
    if (insertError || !session) {
      return serverError()
    }

    return json({ sessionId: session.id, salt: realSalt, B: ephemeral.public })
  } catch (_err) {
    return serverError()
  }
})
