// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockRegister = vi.fn()
const mockLogin = vi.fn()
const mockSignOut = vi.fn()
const mockDeleteAccount = vi.fn()
const mockGetCurrentSession = vi.fn()
const mockChangeSrpPassword = vi.fn()

vi.mock('../utils/auth/usernameAuthService', () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
  changeSrpPassword: (...args: unknown[]) => mockChangeSrpPassword(...args),
}))

const mockCryptoSetup = vi.fn()
const mockCryptoUnlock = vi.fn()
const mockCryptoIsSetUp = vi.fn()
const mockCryptoClear = vi.fn()
const mockCryptoUpdatePassword = vi.fn()
const mockCryptoTeardown = vi.fn()

vi.mock('../utils/crypto/cryptoService', () => ({
  cryptoService: {
    setup: (...args: unknown[]) => mockCryptoSetup(...args),
    unlock: (...args: unknown[]) => mockCryptoUnlock(...args),
    isSetUp: (...args: unknown[]) => mockCryptoIsSetUp(...args),
    clear: (...args: unknown[]) => mockCryptoClear(...args),
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

const mockSettingsLoadSettings = vi.fn()
const mockSettingsSetArgon2Params = vi.fn()
const mockSettingsSetIdleTimeoutMinutes = vi.fn()
const mockSettingsReset = vi.fn()

vi.mock('./settingsStore', () => ({
  useSettingsStore: () => ({
    loadSettings: mockSettingsLoadSettings,
    setArgon2Params: mockSettingsSetArgon2Params,
    setIdleTimeoutMinutes: mockSettingsSetIdleTimeoutMinutes,
    resetSettings: mockSettingsReset,
  }),
}))

const mockNoteClearNoteText = vi.fn()
const mockNoteLoadNote = vi.fn()

vi.mock('./noteStore', () => ({
  useNoteStore: () => ({
    clearNoteText: mockNoteClearNoteText,
    loadNote: mockNoteLoadNote,
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
  mockRegister.mockResolvedValue('uid-1')
  mockLogin.mockResolvedValue('uid-1')
  mockSignOut.mockResolvedValue(undefined)
  mockDeleteAccount.mockResolvedValue(undefined)
  mockChangeSrpPassword.mockResolvedValue(undefined)

  mockCryptoSetup.mockResolvedValue({ masterKey: FAKE_MASTER_KEY, params: FAKE_PARAMS })
  mockCryptoUnlock.mockResolvedValue({ masterKey: FAKE_DERIVABLE_KEY, params: FAKE_PARAMS })
  mockCryptoIsSetUp.mockResolvedValue(true)
  mockCryptoClear.mockReturnValue(undefined)
  mockCryptoUpdatePassword.mockResolvedValue(undefined)
  mockCryptoTeardown.mockResolvedValue(undefined)

  mockCheckLockout.mockResolvedValue(undefined)
  mockRecordFailedAttempt.mockResolvedValue(undefined)
  mockLockoutReset.mockResolvedValue(undefined)

  mockSettingsLoadSettings.mockResolvedValue(null)
  mockSettingsSetArgon2Params.mockResolvedValue(undefined)
  mockSettingsSetIdleTimeoutMinutes.mockResolvedValue(undefined)
  mockSettingsReset.mockReturnValue(undefined)

  mockNoteClearNoteText.mockReturnValue(undefined)
  mockNoteLoadNote.mockResolvedValue(undefined)
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
  it('calls register and cryptoService.setup with the password', async () => {
    const store = useAuthStore()
    await store.setup('alice', 'password123')

    expect(mockRegister).toHaveBeenCalledWith('alice', 'password123')
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
    expect(mockSettingsSetArgon2Params).toHaveBeenCalledWith(FAKE_PARAMS)
  })

  it('clears userId and username and re-throws on error', async () => {
    mockRegister.mockRejectedValue(new Error('Username already taken.'))
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

  it('calls login and cryptoService.unlock', async () => {
    const store = useAuthStore()
    await store.unlock('alice', 'pass')

    expect(mockLogin).toHaveBeenCalledWith('alice', 'pass')
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
    mockLogin.mockRejectedValue(credError)
    const store = useAuthStore()

    await expect(store.unlock('alice', 'wrong')).rejects.toMatchObject(credError)
    expect(mockRecordFailedAttempt).toHaveBeenCalled()
  })

  it('does NOT record failed attempt for other error types', async () => {
    mockLogin.mockRejectedValue(new Error('network error'))
    const store = useAuthStore()

    await expect(store.unlock('alice', 'pass')).rejects.toThrow()
    expect(mockRecordFailedAttempt).not.toHaveBeenCalled()
  })

  it('clears masterKey on failure', async () => {
    mockLogin.mockRejectedValue(new Error('fail'))
    const store = useAuthStore()
    store.userId = 'uid-1' as string | null
    store.username = 'alice'

    await expect(store.unlock('alice', 'pass')).rejects.toThrow()

    expect(store.masterKey).toBeNull()
  })
})

describe('authStore.lock', () => {
  it('calls cryptoService.clear and clears masterKey', async () => {
    const store = useAuthStore()
    store.masterKey = FAKE_MASTER_KEY as CryptoKey | null
    await store.lock()

    expect(mockCryptoClear).toHaveBeenCalled()
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
  it('calls cryptoService.clear, clears all state, and calls signOut', async () => {
    const store = useAuthStore()
    store.userId = 'uid-1' as string | null
    store.username = 'alice' as string | null
    await store.logout()

    expect(mockCryptoClear).toHaveBeenCalled()
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
  it('re-encrypts locally then updates the SRP credential', async () => {
    const store = useAuthStore()
    store.username = 'alice' as string | null

    await store.changePassword('oldPass', 'newPass')

    expect(mockCryptoUpdatePassword).toHaveBeenCalledWith('oldPass', 'newPass')
    expect(mockChangeSrpPassword).toHaveBeenCalledWith('alice', 'oldPass', 'newPass')
  })

  it('throws when username is not set', async () => {
    const store = useAuthStore()
    store.username = null
    await expect(store.changePassword('old', 'new')).rejects.toThrow('Not authenticated')
  })

  it('rolls back the local re-encryption when the SRP update fails', async () => {
    const store = useAuthStore()
    store.username = 'alice' as string | null

    mockChangeSrpPassword.mockRejectedValue(new Error('server failure'))

    await expect(store.changePassword('oldPass', 'newPass')).rejects.toThrow('server failure')

    expect(mockCryptoUpdatePassword).toHaveBeenCalledTimes(2)
    expect(mockCryptoUpdatePassword).toHaveBeenLastCalledWith('newPass', 'oldPass')
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
