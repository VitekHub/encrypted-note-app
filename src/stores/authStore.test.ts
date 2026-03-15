// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockSignUp = vi.fn()
const mockSignIn = vi.fn()
const mockSignOut = vi.fn()
const mockDeleteAccount = vi.fn()
const mockGetCurrentSession = vi.fn()
const mockDeriveAuthToken = vi.fn()

vi.mock('../utils/auth/usernameAuthService', () => ({
  signUp: (...args: unknown[]) => mockSignUp(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
  deriveAuthToken: (...args: unknown[]) => mockDeriveAuthToken(...args),
}))

const mockCryptoSetup = vi.fn()
const mockCryptoUnlock = vi.fn()
const mockCryptoIsSetUp = vi.fn()
const mockCryptoLock = vi.fn()
const mockCryptoUpdatePassword = vi.fn()
const mockCryptoTeardown = vi.fn()

vi.mock('../utils/crypto/cryptoService', () => ({
  cryptoService: {
    setup: (...args: unknown[]) => mockCryptoSetup(...args),
    unlock: (...args: unknown[]) => mockCryptoUnlock(...args),
    isSetUp: (...args: unknown[]) => mockCryptoIsSetUp(...args),
    lock: (...args: unknown[]) => mockCryptoLock(...args),
    updatePassword: (...args: unknown[]) => mockCryptoUpdatePassword(...args),
    teardown: (...args: unknown[]) => mockCryptoTeardown(...args),
  },
}))

const mockCheckLockout = vi.fn()
const mockRecordFailedAttempt = vi.fn()
const mockLockoutReset = vi.fn()

vi.mock('../utils/loginLockoutService', () => ({
  loginLockoutService: {
    checkLockout: (...args: unknown[]) => mockCheckLockout(...args),
    recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
    reset: (...args: unknown[]) => mockLockoutReset(...args),
  },
  LockoutError: class LockoutError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'LockoutError'
    }
  },
}))

const mockUpdateUser = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}))

const mockSettingsLoadSettings = vi.fn()
const mockSettingsUpdateSettings = vi.fn()
const mockSettingsReset = vi.fn()

vi.mock('./settingsStore', () => ({
  useSettingsStore: () => ({
    loadSettings: mockSettingsLoadSettings,
    updateSettings: mockSettingsUpdateSettings,
    resetSettings: mockSettingsReset,
  }),
}))

const mockNoteClearNoteText = vi.fn()

vi.mock('./noteStore', () => ({
  useNoteStore: () => ({
    clearNoteText: mockNoteClearNoteText,
  }),
}))

import { useAuthStore } from './authStore'

const FAKE_MASTER_KEY = {} as CryptoKey
const FAKE_PARAMS = { memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 }
const FAKE_DERIVABLE_KEY = {} as CryptoKey

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()

  mockGetCurrentSession.mockResolvedValue(null)
  mockSignUp.mockResolvedValue('uid-1')
  mockSignIn.mockResolvedValue('uid-1')
  mockSignOut.mockResolvedValue(undefined)
  mockDeleteAccount.mockResolvedValue(undefined)
  mockDeriveAuthToken.mockResolvedValue('hex-token')

  mockCryptoSetup.mockResolvedValue({ masterKey: FAKE_MASTER_KEY, params: FAKE_PARAMS })
  mockCryptoUnlock.mockResolvedValue({ masterKey: FAKE_DERIVABLE_KEY, params: FAKE_PARAMS })
  mockCryptoIsSetUp.mockResolvedValue(true)
  mockCryptoLock.mockReturnValue(undefined)
  mockCryptoUpdatePassword.mockResolvedValue(undefined)
  mockCryptoTeardown.mockResolvedValue(undefined)

  mockCheckLockout.mockResolvedValue(undefined)
  mockRecordFailedAttempt.mockResolvedValue(undefined)
  mockLockoutReset.mockResolvedValue(undefined)

  mockUpdateUser.mockResolvedValue({ error: null })

  mockSettingsLoadSettings.mockResolvedValue(null)
  mockSettingsUpdateSettings.mockResolvedValue(undefined)
  mockSettingsReset.mockReturnValue(undefined)

  mockNoteClearNoteText.mockReturnValue(undefined)
})

describe('authStore.initSession', () => {
  it('sets isInitialized to true regardless of session', async () => {
    const store = useAuthStore()
    await store.initSession()
    expect(store.isInitialized).toBe(true)
  })

  it('sets userId and username when session exists', async () => {
    mockGetCurrentSession.mockResolvedValue({ userId: 'uid-1', username: 'alice' })
    mockCryptoIsSetUp.mockResolvedValue(true)

    const store = useAuthStore()
    await store.initSession()

    expect(store.userId).toBe('uid-1')
    expect(store.username).toBe('alice')
    expect(store.keysExist).toBe(true)
  })

  it('clears state when no session', async () => {
    mockGetCurrentSession.mockResolvedValue(null)
    const store = useAuthStore()
    store.userId = 'old-id' as string | null
    await store.initSession()

    expect(store.userId).toBeNull()
    expect(store.username).toBeNull()
    expect(store.keysExist).toBe(false)
  })
})

describe('authStore.setup', () => {
  it('calls signUp and cryptoService.setup with the password', async () => {
    const store = useAuthStore()
    await store.setup('alice', 'password123')

    expect(mockSignUp).toHaveBeenCalledWith('alice', 'password123')
    expect(mockCryptoSetup).toHaveBeenCalledWith('password123')
  })

  it('sets userId, username, masterKey, and keysExist on success', async () => {
    const store = useAuthStore()
    await store.setup('Alice', 'password123')

    expect(store.userId).toBe('uid-1')
    expect(store.username).toBe('alice')
    expect(store.masterKey).toStrictEqual(FAKE_MASTER_KEY)
    expect(store.keysExist).toBe(true)
  })

  it('loads settings and stores argon2 params on success', async () => {
    const store = useAuthStore()
    await store.setup('alice', 'password123')

    expect(mockSettingsLoadSettings).toHaveBeenCalled()
    expect(mockSettingsUpdateSettings).toHaveBeenCalledWith({ argon2Params: FAKE_PARAMS })
  })

  it('clears userId and username and re-throws on error', async () => {
    mockSignUp.mockRejectedValue(new Error('Username already taken.'))
    const store = useAuthStore()

    await expect(store.setup('alice', 'pass')).rejects.toThrow('Username already taken.')
    expect(store.userId).toBeNull()
    expect(store.username).toBeNull()
  })

  it('sets isLoading false after completion', async () => {
    const store = useAuthStore()
    await store.setup('alice', 'pass')
    expect(store.isLoading).toBe(false)
  })
})

describe('authStore.unlock', () => {
  it('checks lockout before proceeding', async () => {
    const store = useAuthStore()
    await store.unlock('alice', 'pass')
    expect(mockCheckLockout).toHaveBeenCalled()
  })

  it('calls signIn and cryptoService.unlock', async () => {
    const store = useAuthStore()
    await store.unlock('alice', 'pass')

    expect(mockSignIn).toHaveBeenCalledWith('alice', 'pass')
    expect(mockCryptoUnlock).toHaveBeenCalledWith('pass')
  })

  it('sets masterKey and resets lockout on success', async () => {
    const store = useAuthStore()
    await store.unlock('alice', 'pass')

    expect(store.masterKey).toStrictEqual(FAKE_DERIVABLE_KEY)
    expect(mockLockoutReset).toHaveBeenCalled()
  })

  it('records failed attempt for invalid_credentials error', async () => {
    const credError = { code: 'invalid_credentials', message: 'bad creds' }
    mockSignIn.mockRejectedValue(credError)
    const store = useAuthStore()

    await expect(store.unlock('alice', 'wrong')).rejects.toMatchObject(credError)
    expect(mockRecordFailedAttempt).toHaveBeenCalled()
  })

  it('does NOT record failed attempt for other error types', async () => {
    mockSignIn.mockRejectedValue(new Error('network error'))
    const store = useAuthStore()

    await expect(store.unlock('alice', 'pass')).rejects.toThrow()
    expect(mockRecordFailedAttempt).not.toHaveBeenCalled()
  })

  it('clears all state on failure', async () => {
    mockSignIn.mockRejectedValue(new Error('fail'))
    const store = useAuthStore()
    store.userId = 'uid-1' as string | null

    await expect(store.unlock('alice', 'pass')).rejects.toThrow()

    expect(store.userId).toBeNull()
    expect(store.username).toBeNull()
    expect(store.masterKey).toBeNull()
  })
})

describe('authStore.unlockExistingSession', () => {
  it('unlocks without calling signIn', async () => {
    const store = useAuthStore()
    await store.unlockExistingSession('pass')

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockCryptoUnlock).toHaveBeenCalledWith('pass')
    expect(store.masterKey).toStrictEqual(FAKE_DERIVABLE_KEY)
  })

  it('loads settings on success', async () => {
    const store = useAuthStore()
    await store.unlockExistingSession('pass')
    expect(mockSettingsLoadSettings).toHaveBeenCalled()
  })

  it('sets error and re-throws when unlock fails', async () => {
    mockCryptoUnlock.mockRejectedValue(new Error('wrong password'))
    const store = useAuthStore()

    await expect(store.unlockExistingSession('wrong')).rejects.toThrow('wrong password')
    expect(store.error).toBeTruthy()
  })
})

describe('authStore.lock', () => {
  it('calls cryptoService.lock and clears masterKey', async () => {
    const store = useAuthStore()
    store.masterKey = FAKE_MASTER_KEY as CryptoKey | null
    await store.lock()

    expect(mockCryptoLock).toHaveBeenCalled()
    expect(store.masterKey).toBeNull()
  })

  it('resets settings and clears note text', async () => {
    const store = useAuthStore()
    await store.lock()

    expect(mockSettingsReset).toHaveBeenCalled()
    expect(mockNoteClearNoteText).toHaveBeenCalled()
  })
})

describe('authStore.logout', () => {
  it('calls cryptoService.lock, clears all state, and calls signOut', async () => {
    const store = useAuthStore()
    store.userId = 'uid-1' as string | null
    store.username = 'alice' as string | null
    await store.logout()

    expect(mockCryptoLock).toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalled()
    expect(store.userId).toBeNull()
    expect(store.username).toBeNull()
    expect(store.keysExist).toBe(false)
    expect(store.masterKey).toBeNull()
  })

  it('resets settings and clears note text', async () => {
    const store = useAuthStore()
    await store.logout()

    expect(mockSettingsReset).toHaveBeenCalled()
    expect(mockNoteClearNoteText).toHaveBeenCalled()
  })
})

describe('authStore.changePassword', () => {
  it('derives tokens and calls supabase.auth.updateUser then cryptoService.updatePassword', async () => {
    const store = useAuthStore()
    store.username = 'alice' as string | null

    mockDeriveAuthToken.mockResolvedValueOnce('old-token').mockResolvedValueOnce('new-token')

    await store.changePassword('oldPass', 'newPass')

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-token' })
    expect(mockCryptoUpdatePassword).toHaveBeenCalledWith('oldPass', 'newPass')
  })

  it('throws when username is not set', async () => {
    const store = useAuthStore()
    store.username = null
    await expect(store.changePassword('old', 'new')).rejects.toThrow('Not authenticated')
  })

  it('rolls back the Supabase password update when cryptoService.updatePassword throws', async () => {
    const store = useAuthStore()
    store.username = 'alice' as string | null

    mockDeriveAuthToken.mockResolvedValueOnce('old-token').mockResolvedValueOnce('new-token')
    mockCryptoUpdatePassword.mockRejectedValue(new Error('crypto failure'))

    await expect(store.changePassword('oldPass', 'newPass')).rejects.toThrow('crypto failure')

    expect(mockUpdateUser).toHaveBeenCalledTimes(2)
    expect(mockUpdateUser).toHaveBeenLastCalledWith({ password: 'old-token' })
  })
})

describe('authStore.teardown', () => {
  it('calls cryptoService.teardown, deleteAccount, and signOut', async () => {
    const store = useAuthStore()
    await store.teardown()

    expect(mockCryptoTeardown).toHaveBeenCalled()
    expect(mockDeleteAccount).toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('clears all state', async () => {
    const store = useAuthStore()
    store.userId = 'uid-1' as string | null
    store.username = 'alice' as string | null
    await store.teardown()

    expect(store.userId).toBeNull()
    expect(store.username).toBeNull()
    expect(store.masterKey).toBeNull()
    expect(store.keysExist).toBe(false)
  })

  it('resets settings and clears note text', async () => {
    const store = useAuthStore()
    await store.teardown()

    expect(mockSettingsReset).toHaveBeenCalled()
    expect(mockNoteClearNoteText).toHaveBeenCalled()
  })
})

describe('authStore computed', () => {
  it('isAuthenticated is true when masterKey is set', () => {
    const store = useAuthStore()
    store.masterKey = FAKE_MASTER_KEY as CryptoKey | null
    expect(store.isAuthenticated).toBe(true)
  })

  it('isAuthenticated is false when masterKey is null', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
  })

  it('hasSupabaseSession is true when userId is set', () => {
    const store = useAuthStore()
    store.userId = 'uid-1' as string | null
    expect(store.hasSupabaseSession).toBe(true)
  })

  it('hasSupabaseSession is false when userId is null', () => {
    const store = useAuthStore()
    expect(store.hasSupabaseSession).toBe(false)
  })
})
