export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

/** Standardized, user-facing error messages shared by every SRP function. */
export const ERR = {
  METHOD_NOT_ALLOWED: 'Method not allowed',
  RATE_LIMITED: 'Too many attempts. Please try again shortly.',
  SERVER: 'Something went wrong. Please try again.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  INVALID_REQUEST: 'Invalid request.',
  INVALID_USERNAME: 'Invalid username.',
  MISSING_CREDENTIALS: 'Missing SRP credentials.',
  UNSUPPORTED_GROUP: 'Unsupported SRP group.',
  USERNAME_TAKEN: 'Username already taken.',
  NOT_AUTHENTICATED: 'Not authenticated.',
  NOT_AUTHORIZED: 'Not authorized.',
  HANDSHAKE_EXPIRED: 'Handshake expired.',
} as const

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Status-named error responses, each defaulting to its canonical message. */
export const badRequest = (message: string = ERR.INVALID_REQUEST) => json({ error: message }, 400)
export const unauthorized = (message: string = ERR.INVALID_CREDENTIALS) => json({ error: message }, 401)
export const forbidden = (message: string = ERR.NOT_AUTHORIZED) => json({ error: message }, 403)
export const notAllowed = () => json({ error: ERR.METHOD_NOT_ALLOWED }, 405)
export const conflict = (message: string = ERR.USERNAME_TAKEN) => json({ error: message }, 409)
export const tooManyRequests = () => json({ error: ERR.RATE_LIMITED }, 429)
export const serverError = () => json({ error: ERR.SERVER }, 500)

/**
 * Handles the CORS preflight and rejects non-POST verbs. Returns a Response to
 * short-circuit the handler, or null when the request may proceed.
 */
export function guardPost(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return notAllowed()
  }
  return null
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const buckets = new Map<string, number[]>()

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}

/**
 * Best-effort per-IP throttle. In-memory, so it only spans a warm instance; it
 * is a first barrier against scripted probing, not a hard guarantee.
 */
/** Caps tracked IPs so the map can't grow without bound. */
const MAX_BUCKETS = 10_000

export function isRateLimited(key: string, max = 15, windowMs = RATE_LIMIT_WINDOW_MS): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  hits.push(now)
  buckets.set(key, hits)
  // Evict fully-stale keys once the map gets large.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, ts] of buckets) {
      if (ts.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return hits.length > max
}
