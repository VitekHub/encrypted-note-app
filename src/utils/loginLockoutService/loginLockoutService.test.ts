import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loginLockoutService, LockoutError } from './loginLockoutServiceImpl'
import { cryptoKeyStorage } from '../crypto/keyStorage'

vi.mock('../crypto/keyStorage', () => ({
  cryptoKeyStorage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}))

// Helper matching the one in loginLockoutServiceImpl
async function calculateTestSignature(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value + 'd8f9q2438hf9q284hfq2834hfq2384hf')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return btoa(String.fromCharCode(...hashArray))
}

describe('loginLockoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkLockout', () => {
    it('should pass if no lockout is set', async () => {
      vi.mocked(cryptoKeyStorage.get).mockResolvedValue(undefined)
      await expect(loginLockoutService.checkLockout()).resolves.toBeUndefined()
    })

    it('should pass if lockout has expired', async () => {
      const pastTime = Date.now() - 1000
      const sig = await calculateTestSignature(pastTime.toString())

      vi.mocked(cryptoKeyStorage.get).mockImplementation(async (key) => {
        if (key === 'login_lockout_lock_until') return pastTime.toString()
        if (key === 'login_lockout_lock_until_sig') return sig
        return undefined
      })
      await expect(loginLockoutService.checkLockout()).resolves.toBeUndefined()
    })

    it('should throw LockoutError if lockout is still active', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const futureTime = now + 5000 // locked for 5 more seconds
      const sig = await calculateTestSignature(futureTime.toString())

      vi.mocked(cryptoKeyStorage.get).mockImplementation(async (key) => {
        if (key === 'login_lockout_lock_until') return futureTime.toString()
        if (key === 'login_lockout_lock_until_sig') return sig
        return undefined
      })

      await expect(loginLockoutService.checkLockout()).rejects.toThrow(LockoutError)
      await expect(loginLockoutService.checkLockout()).rejects.toThrow(
        'Too many failed attempts. Try again in 5 seconds.'
      )
    })

    it('should throw max LockoutError if signature is invalid (tampering detected)', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const futureTime = now + 5000

      vi.mocked(cryptoKeyStorage.get).mockImplementation(async (key) => {
        if (key === 'login_lockout_lock_until') return futureTime.toString()
        if (key === 'login_lockout_lock_until_sig') return 'invalid_signature_here'
        return undefined
      })

      // tampering defaults to max lockout (3600 seconds)
      await expect(loginLockoutService.checkLockout()).rejects.toThrow(LockoutError)
      await expect(loginLockoutService.checkLockout()).rejects.toThrow(
        'Too many failed attempts. Try again in 3600 seconds.'
      )
    })
  })

  describe('recordFailedAttempt', () => {
    it('should set 1 second lockout on first failure', async () => {
      vi.mocked(cryptoKeyStorage.get).mockResolvedValue(undefined) // 0 attempts so far

      const now = Date.now()
      vi.setSystemTime(now)

      await loginLockoutService.recordFailedAttempt()

      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_attempts', '1')
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_attempts_sig', expect.any(String))
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_lock_until', (now + 1000).toString())
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_lock_until_sig', expect.any(String))
    })

    it('should set 2 second lockout on second failure', async () => {
      const sig = await calculateTestSignature('1')

      vi.mocked(cryptoKeyStorage.get).mockImplementation(async (key) => {
        if (key === 'login_lockout_attempts') return '1'
        if (key === 'login_lockout_attempts_sig') return sig
        return undefined
      })

      const now = Date.now()
      vi.setSystemTime(now)

      await loginLockoutService.recordFailedAttempt()

      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_attempts', '2')
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_attempts_sig', expect.any(String))
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_lock_until', (now + 2000).toString())
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_lock_until_sig', expect.any(String))
    })

    it('should cap out at 1 hour for >= 10 failures', async () => {
      const sig = await calculateTestSignature('15')

      vi.mocked(cryptoKeyStorage.get).mockImplementation(async (key) => {
        if (key === 'login_lockout_attempts') return '15'
        if (key === 'login_lockout_attempts_sig') return sig
        return undefined
      })

      const now = Date.now()
      vi.setSystemTime(now)

      await loginLockoutService.recordFailedAttempt()

      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_attempts', '16')
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_attempts_sig', expect.any(String))
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_lock_until', (now + 3600000).toString())
      expect(cryptoKeyStorage.set).toHaveBeenCalledWith('login_lockout_lock_until_sig', expect.any(String))
    })
  })

  describe('reset', () => {
    it('should clear all 4 storage keys', async () => {
      await loginLockoutService.reset()

      expect(cryptoKeyStorage.delete).toHaveBeenCalledWith('login_lockout_attempts')
      expect(cryptoKeyStorage.delete).toHaveBeenCalledWith('login_lockout_attempts_sig')
      expect(cryptoKeyStorage.delete).toHaveBeenCalledWith('login_lockout_lock_until')
      expect(cryptoKeyStorage.delete).toHaveBeenCalledWith('login_lockout_lock_until_sig')
    })
  })
})
