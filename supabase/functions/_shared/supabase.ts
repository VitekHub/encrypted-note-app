import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

/** Service-role key, also used to seed deterministic login decoys. */
export const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Full-access client. Bypasses RLS; use only inside trusted server logic. */
export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey)
}

/** Anonymous client with no persisted session, e.g. for OTP verification. */
export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

/** Client scoped to the caller's JWT, for identifying the current user. */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}
