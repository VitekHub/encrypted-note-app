import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as srpServer from 'npm:secure-remote-password@0.3.1/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const SESSION_TTL_MS = 2 * 60 * 1000

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
    const username = typeof body?.username === 'string' ? body.username.toLowerCase() : ''
    if (!username) {
      return json({ error: 'Invalid credentials.' }, 400)
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    await supabase.from('srp_sessions').delete().lt('expires_at', new Date().toISOString())

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (profileError) {
      return json({ error: 'Login failed.' }, 500)
    }
    if (!profile) {
      return json({ error: 'Invalid credentials.' }, 404)
    }

    const { data: cred, error: credError } = await supabase
      .from('srp_credentials')
      .select('salt, verifier')
      .eq('user_id', profile.id)
      .maybeSingle()
    if (credError) {
      return json({ error: 'Login failed.' }, 500)
    }
    if (!cred) {
      return json({ error: 'Invalid credentials.' }, 404)
    }

    const ephemeral = srpServer.generateEphemeral(cred.verifier)

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

    return json({ sessionId: session.id, salt: cred.salt, B: ephemeral.public })
  } catch (_err) {
    return json({ error: 'Login failed.' }, 500)
  }
})
