import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const USERNAME_DOMAIN = 'ciphernote.local'
const SRP_GROUP = 'RFC5054-2048'
const USERNAME_RE = /^[a-zA-Z0-9_]+$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function randomPassword(): string {
  const bytes = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
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
    const salt = typeof body?.salt === 'string' ? body.salt : ''
    const verifier = typeof body?.verifier === 'string' ? body.verifier : ''
    const group = typeof body?.group === 'string' ? body.group : ''

    if (username.length < 3 || username.length > 32 || !USERNAME_RE.test(username)) {
      return json({ error: 'Invalid username.' }, 400)
    }
    if (!salt || !verifier) {
      return json({ error: 'Missing SRP credentials.' }, 400)
    }
    if (group !== SRP_GROUP) {
      return json({ error: 'Unsupported SRP group.' }, 400)
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: existing, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (lookupError) {
      return json({ error: 'Registration failed.' }, 500)
    }
    if (existing) {
      return json({ error: 'Username already taken.' }, 409)
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: `${username}@${USERNAME_DOMAIN}`,
      password: randomPassword(),
      email_confirm: true,
    })
    if (createError || !created?.user) {
      const msg = createError?.message ?? ''
      if (msg.toLowerCase().includes('already')) {
        return json({ error: 'Username already taken.' }, 409)
      }
      return json({ error: 'Registration failed.' }, 500)
    }

    const userId = created.user.id

    const { error: profileError } = await supabase.from('profiles').insert({ id: userId, username })
    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      const taken = profileError.message.toLowerCase().includes('duplicate')
      return json({ error: taken ? 'Username already taken.' : 'Registration failed.' }, taken ? 409 : 500)
    }

    const { error: credError } = await supabase
      .from('srp_credentials')
      .insert({ user_id: userId, salt, verifier, srp_group: group })
    if (credError) {
      await supabase.auth.admin.deleteUser(userId)
      return json({ error: 'Registration failed.' }, 500)
    }

    return json({ userId })
  } catch (_err) {
    return json({ error: 'Registration failed.' }, 500)
  }
})
