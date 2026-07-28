import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as srpServer from 'npm:secure-remote-password@0.3.1/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

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
    const newSalt = typeof body?.salt === 'string' ? body.salt : ''
    const newVerifier = typeof body?.verifier === 'string' ? body.verifier : ''
    const newGroup = typeof body?.group === 'string' ? body.group : ''
    if (!sessionId || !clientPublic || !clientProof || !newSalt || !newVerifier || !newGroup) {
      return json({ error: 'Invalid request.' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Not authenticated.' }, 401)
    }

    const supabase = createClient(url, serviceKey)

    const { data: session, error: sessionError } = await supabase
      .from('srp_sessions')
      .select('id, user_id, server_b, expires_at')
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionError) {
      return json({ error: 'Password change failed.' }, 500)
    }
    if (!session) {
      return json({ error: 'Invalid credentials.' }, 401)
    }

    // Single-use handshake row: remove it regardless of outcome.
    await supabase.from('srp_sessions').delete().eq('id', session.id)

    if (session.user_id !== user.id) {
      return json({ error: 'Not authorized.' }, 403)
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      return json({ error: 'Session expired.' }, 401)
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
      return json({ error: 'Password change failed.' }, 500)
    }

    // Prove knowledge of the OLD password against the stored verifier.
    try {
      srpServer.deriveSession(session.server_b, clientPublic, cred.salt, profile.username, cred.verifier, clientProof)
    } catch (_e) {
      return json({ error: 'Invalid credentials.' }, 401)
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
      return json({ error: 'Password change failed.' }, 500)
    }

    return json({ success: true })
  } catch (_err) {
    return json({ error: 'Password change failed.' }, 500)
  }
})
