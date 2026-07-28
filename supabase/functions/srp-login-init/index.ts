import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as srpServer from 'npm:secure-remote-password@0.3.1/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const SESSION_TTL_MS = 2 * 60 * 1000

// Best-effort per-IP throttle. In-memory, so it only spans a warm instance;
// it is a first barrier against scripted probing, not a hard guarantee.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 15
const recentAttempts = new Map<string, number[]>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recentAttempts.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  hits.push(now)
  recentAttempts.set(key, hits)
  return hits.length > RATE_LIMIT_MAX
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (isRateLimited(clientIp(req))) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429)
  }

  try {
    const body = await req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.toLowerCase() : ''
    if (!username) {
      return json({ error: 'Invalid credentials.' }, 400)
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

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
      return json({ error: 'Login failed.' }, 500)
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
        return json({ error: 'Login failed.' }, 500)
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
      return json({ error: 'Login failed.' }, 500)
    }

    return json({ sessionId: session.id, salt: realSalt, B: ephemeral.public })
  } catch (_err) {
    return json({ error: 'Login failed.' }, 500)
  }
})
