import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as srpServer from 'npm:secure-remote-password@0.3.1/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const USERNAME_DOMAIN = 'ciphernote.local'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json().catch(() => null)
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
    const clientPublic = typeof body?.A === 'string' ? body.A : ''
    const clientProof = typeof body?.M1 === 'string' ? body.M1 : ''
    if (!sessionId || !clientPublic || !clientProof) {
      return json({ error: 'Invalid credentials.' }, 400)
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: session, error: sessionError } = await supabase
      .from('srp_sessions')
      .select('id, user_id, server_b, expires_at')
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionError) {
      return json({ error: 'Login failed.' }, 500)
    }
    if (!session) {
      return json({ error: 'Invalid credentials.' }, 401)
    }

    // The session is single-use: remove it regardless of whether the proof verifies.
    await supabase.from('srp_sessions').delete().eq('id', session.id)

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return json({ error: 'Login session expired.' }, 401)
    }

    const { data: cred, error: credError } = await supabase
      .from('srp_credentials')
      .select('salt, verifier')
      .eq('user_id', session.user_id)
      .maybeSingle()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user_id)
      .maybeSingle()
    if (credError || profileError || !cred || !profile) {
      return json({ error: 'Login failed.' }, 500)
    }

    let serverSession: { key: string; proof: string }
    try {
      serverSession = srpServer.deriveSession(
        session.server_b,
        clientPublic,
        cred.salt,
        profile.username,
        cred.verifier,
        clientProof
      )
    } catch (_e) {
      return json({ error: 'Invalid credentials.' }, 401)
    }

    const email = `${profile.username}@${USERNAME_DOMAIN}`
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) {
      return json({ error: 'Login failed.' }, 500)
    }

    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: verified, error: otpError } = await authClient.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (otpError || !verified?.session) {
      return json({ error: 'Login failed.' }, 500)
    }

    return json({
      M2: serverSession.proof,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    })
  } catch (_err) {
    return json({ error: 'Login failed.' }, 500)
  }
})
