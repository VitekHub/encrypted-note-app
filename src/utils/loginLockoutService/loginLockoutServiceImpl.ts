import type { LoginLockoutService } from './types'
import { encode } from 'js-base64'

const ATTEMPTS_KEY = 'login_lockout_attempts'
const LOCK_UNTIL_KEY = 'login_lockout_lock_until'
const ATTEMPTS_SIG_KEY = 'login_lockout_attempts_sig'
const LOCK_UNTIL_SIG_KEY = 'login_lockout_lock_until_sig'

// Hardcoded secret for local HMAC signing to prevent casual DevTools tampering.
const LOCKOUT_SECRET = 'd8f9q2438hf9q284hfq2834hfq2384hf'

// Helper to calculate a simple HMAC-like signature
async function calculateSignature(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value + LOCKOUT_SECRET)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return encode(String.fromCharCode(...hashArray))
}

// Exponential backoff configuration
const BACKOFF_DURATIONS_SECONDS = [1, 2, 4, 8, 15, 30, 60, 300, 900, 3600] // Max 1 hour

export class LockoutError extends Error {
  constructor(public remainingSeconds: number) {
    super(`Too many failed attempts. Try again in ${remainingSeconds} seconds.`)
    this.name = 'LockoutError'
  }
}

export const loginLockoutService: LoginLockoutService = {
  /** @inheritdoc */
  async checkLockout(): Promise<void> {
    const lockUntilStr = localStorage.getItem(LOCK_UNTIL_KEY)
    const lockUntilSig = localStorage.getItem(LOCK_UNTIL_SIG_KEY)

    if (!lockUntilStr) return

    // If a lock exists but signature is missing or invalid, fail closed
    if (!lockUntilSig || lockUntilSig !== (await calculateSignature(lockUntilStr))) {
      throw new LockoutError(3600) // Default to max lockout on tampering
    }

    const lockUntil = parseInt(lockUntilStr, 10)
    if (isNaN(lockUntil)) return

    const now = Date.now()
    if (now < lockUntil) {
      const remainingSeconds = Math.ceil((lockUntil - now) / 1000)
      throw new LockoutError(remainingSeconds)
    }
  },

  /** @inheritdoc */
  async recordFailedAttempt(): Promise<void> {
    let attempts = 0
    const attemptsStr = localStorage.getItem(ATTEMPTS_KEY)
    const attemptsSig = localStorage.getItem(ATTEMPTS_SIG_KEY)

    // Only trust the previous attempts count if the signature matches
    if (attemptsStr && attemptsSig && attemptsSig === (await calculateSignature(attemptsStr))) {
      attempts = parseInt(attemptsStr, 10)
    }

    attempts += 1

    // Determine lockout duration based on attempt number
    // We start locking out on the very first fail (index 0)
    const backoffIndex = Math.min(attempts - 1, BACKOFF_DURATIONS_SECONDS.length - 1)
    const lockoutDurationMs = BACKOFF_DURATIONS_SECONDS[backoffIndex] * 1000
    const lockUntil = Date.now() + lockoutDurationMs

    const [attemptsSigNew, lockUntilSigNew] = await Promise.all([
      calculateSignature(attempts.toString()),
      calculateSignature(lockUntil.toString()),
    ])

    localStorage.setItem(ATTEMPTS_KEY, attempts.toString())
    localStorage.setItem(ATTEMPTS_SIG_KEY, attemptsSigNew)
    localStorage.setItem(LOCK_UNTIL_KEY, lockUntil.toString())
    localStorage.setItem(LOCK_UNTIL_SIG_KEY, lockUntilSigNew)
  },

  /** @inheritdoc */
  async reset(): Promise<void> {
    localStorage.removeItem(ATTEMPTS_KEY)
    localStorage.removeItem(ATTEMPTS_SIG_KEY)
    localStorage.removeItem(LOCK_UNTIL_KEY)
    localStorage.removeItem(LOCK_UNTIL_SIG_KEY)
  },
}
