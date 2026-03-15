// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loginLockoutService, LockoutError } from './loginLockoutServiceImpl'
import { encode } from 'js-base64'

async function calculateTestSignature(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value + 'd8f9q2438hf9q284hfq2834hfq2384hf')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return encode(String.fromCharCode(...hashArray))
}

describe('loginLockoutService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkLockout', () => {
    it('should pass if no lockout is set', async () => {
      await expect(loginLockoutService.checkLockout()).resolves.toBeUndefined()
    })

    it('should pass if lockout has expired', async () => {
      const pastTime = Date.now() - 1000
      const sig = await calculateTestSignature(pastTime.toString())

      localStorage.setItem('login_lockout_lock_until', pastTime.toString())
      localStorage.setItem('login_lockout_lock_until_sig', sig)

      await expect(loginLockoutService.checkLockout()).resolves.toBeUndefined()
    })

    it('should throw LockoutError if lockout is still active', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const futureTime = now + 5000
      const sig = await calculateTestSignature(futureTime.toString())

      localStorage.setItem('login_lockout_lock_until', futureTime.toString())
      localStorage.setItem('login_lockout_lock_until_sig', sig)

      await expect(loginLockoutService.checkLockout()).rejects.toThrow(LockoutError)
      await expect(loginLockoutService.checkLockout()).rejects.toThrow(
        'Too many failed attempts. Try again in 5 seconds.'
      )
    })

    it('should throw max LockoutError if signature is invalid (tampering detected)', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const futureTime = now + 5000

      localStorage.setItem('login_lockout_lock_until', futureTime.toString())
      localStorage.setItem('login_lockout_lock_until_sig', 'invalid_signature_here')

      await expect(loginLockoutService.checkLockout()).rejects.toThrow(LockoutError)
      await expect(loginLockoutService.checkLockout()).rejects.toThrow(
        'Too many failed attempts. Try again in 3600 seconds.'
      )
    })
  })

  describe('recordFailedAttempt', () => {
    it('should set 1 second lockout on first failure', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      await loginLockoutService.recordFailedAttempt()

      expect(localStorage.getItem('login_lockout_attempts')).toBe('1')
      expect(localStorage.getItem('login_lockout_attempts_sig')).toBe(await calculateTestSignature('1'))
      expect(localStorage.getItem('login_lockout_lock_until')).toBe((now + 1000).toString())
      expect(localStorage.getItem('login_lockout_lock_until_sig')).toBe(
        await calculateTestSignature((now + 1000).toString())
      )
    })

    it('should set 2 second lockout on second failure', async () => {
      const sig = await calculateTestSignature('1')
      localStorage.setItem('login_lockout_attempts', '1')
      localStorage.setItem('login_lockout_attempts_sig', sig)

      const now = Date.now()
      vi.setSystemTime(now)

      await loginLockoutService.recordFailedAttempt()

      expect(localStorage.getItem('login_lockout_attempts')).toBe('2')
      expect(localStorage.getItem('login_lockout_attempts_sig')).toBe(await calculateTestSignature('2'))
      expect(localStorage.getItem('login_lockout_lock_until')).toBe((now + 2000).toString())
      expect(localStorage.getItem('login_lockout_lock_until_sig')).toBe(
        await calculateTestSignature((now + 2000).toString())
      )
    })

    it('should cap out at 1 hour for >= 10 failures', async () => {
      const sig = await calculateTestSignature('15')
      localStorage.setItem('login_lockout_attempts', '15')
      localStorage.setItem('login_lockout_attempts_sig', sig)

      const now = Date.now()
      vi.setSystemTime(now)

      await loginLockoutService.recordFailedAttempt()

      expect(localStorage.getItem('login_lockout_attempts')).toBe('16')
      expect(localStorage.getItem('login_lockout_attempts_sig')).toBe(await calculateTestSignature('16'))
      expect(localStorage.getItem('login_lockout_lock_until')).toBe((now + 3600000).toString())
      expect(localStorage.getItem('login_lockout_lock_until_sig')).toBe(
        await calculateTestSignature((now + 3600000).toString())
      )
    })
  })

  describe('reset', () => {
    it('should clear all 4 storage keys', async () => {
      localStorage.setItem('login_lockout_attempts', '3')
      localStorage.setItem('login_lockout_attempts_sig', 'sig')
      localStorage.setItem('login_lockout_lock_until', '12345')
      localStorage.setItem('login_lockout_lock_until_sig', 'sig2')

      await loginLockoutService.reset()

      expect(localStorage.getItem('login_lockout_attempts')).toBeNull()
      expect(localStorage.getItem('login_lockout_attempts_sig')).toBeNull()
      expect(localStorage.getItem('login_lockout_lock_until')).toBeNull()
      expect(localStorage.getItem('login_lockout_lock_until_sig')).toBeNull()
    })
  })
})
