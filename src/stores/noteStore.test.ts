// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

const mockEncrypt = vi.fn()
const mockDecrypt = vi.fn()
const mockIsEncrypted = vi.fn()

vi.mock('../utils/crypto/cryptoService', () => ({
  cryptoService: {
    encrypt: (...args: unknown[]) => mockEncrypt(...args),
    decrypt: (...args: unknown[]) => mockDecrypt(...args),
    isEncrypted: (...args: unknown[]) => mockIsEncrypted(...args),
  },
}))

const mockFetchUserData = vi.fn()
const mockSaveUserData = vi.fn()
const mockDeleteUserData = vi.fn()
const mockHasUserData = vi.fn()

vi.mock('../utils/supabase/userDataService', () => ({
  fetchUserData: (...args: unknown[]) => mockFetchUserData(...args),
  saveUserData: (...args: unknown[]) => mockSaveUserData(...args),
  deleteUserData: (...args: unknown[]) => mockDeleteUserData(...args),
  hasUserData: (...args: unknown[]) => mockHasUserData(...args),
}))

const masterKeyRef = ref<CryptoKey | null>(null)
const userIdRef = ref<string | null>(null)

vi.mock('./authStore', () => ({
  useAuthStore: () => ({
    masterKey: masterKeyRef,
    userId: userIdRef,
  }),
}))

import { useNoteStore } from './noteStore'

const FAKE_MASTER_KEY = {} as CryptoKey
const USER_ID = 'user-123'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()

  masterKeyRef.value = FAKE_MASTER_KEY
  userIdRef.value = USER_ID

  mockEncrypt.mockResolvedValue('encrypted-blob')
  mockDecrypt.mockResolvedValue('decrypted-plaintext')
  mockIsEncrypted.mockReturnValue(true)
  mockSaveUserData.mockResolvedValue(undefined)
  mockDeleteUserData.mockResolvedValue(undefined)
  mockFetchUserData.mockResolvedValue('encrypted-blob')
  mockHasUserData.mockResolvedValue(true)
})

describe('noteStore.saveNote', () => {
  it('encrypts the text and saves it', async () => {
    const store = useNoteStore()
    await store.saveNote('my secret note')

    expect(mockEncrypt).toHaveBeenCalledWith('my secret note', FAKE_MASTER_KEY, 'note', USER_ID)
    expect(mockSaveUserData).toHaveBeenCalledWith('note', 'encrypted-blob')
  })

  it('sets error and returns early when masterKey is null', async () => {
    masterKeyRef.value = null
    const store = useNoteStore()
    await store.saveNote('text')

    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(store.error).toBeTruthy()
  })

  it('sets error and returns early when userId is null', async () => {
    userIdRef.value = null
    const store = useNoteStore()
    await store.saveNote('text')

    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(store.error).toBeTruthy()
  })

  it('sets error when encrypt throws', async () => {
    mockEncrypt.mockRejectedValue(new Error('crypto failure'))
    const store = useNoteStore()
    await store.saveNote('text')

    expect(store.error).toBeTruthy()
  })

  it('sets loading false after save', async () => {
    const store = useNoteStore()
    await store.saveNote('text')
    expect(store.loading).toBe(false)
  })
})

describe('noteStore.loadNote', () => {
  it('fetches, decrypts, and returns plaintext', async () => {
    const store = useNoteStore()
    const result = await store.loadNote()

    expect(mockFetchUserData).toHaveBeenCalledWith('note')
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-blob', FAKE_MASTER_KEY, 'note', USER_ID)
    expect(result).toBe('decrypted-plaintext')
  })

  it('returns null when no stored data', async () => {
    mockFetchUserData.mockResolvedValue(null)
    const store = useNoteStore()
    const result = await store.loadNote()
    expect(result).toBeNull()
  })

  it('sets error and returns null when stored data is not encrypted', async () => {
    mockIsEncrypted.mockReturnValue(false)
    const store = useNoteStore()
    const result = await store.loadNote()

    expect(result).toBeNull()
    expect(store.error).toBeTruthy()
    expect(mockDecrypt).not.toHaveBeenCalled()
  })

  it('sets error and returns early when masterKey is null', async () => {
    masterKeyRef.value = null
    const store = useNoteStore()
    const result = await store.loadNote()

    expect(result).toBeNull()
    expect(mockFetchUserData).not.toHaveBeenCalled()
  })

  it('sets error when decrypt throws', async () => {
    mockDecrypt.mockRejectedValue(new Error('decryption failed'))
    const store = useNoteStore()
    const result = await store.loadNote()

    expect(result).toBeNull()
    expect(store.error).toBeTruthy()
  })

  it('sets loading false after load', async () => {
    const store = useNoteStore()
    await store.loadNote()
    expect(store.loading).toBe(false)
  })
})

describe('noteStore.hasNote', () => {
  it('returns true when data exists and is encrypted', async () => {
    mockHasUserData.mockResolvedValue(true)
    mockFetchUserData.mockResolvedValue('encrypted-blob')
    mockIsEncrypted.mockReturnValue(true)

    const store = useNoteStore()
    expect(await store.hasNote()).toBe(true)
  })

  it('returns false when hasUserData is false', async () => {
    mockHasUserData.mockResolvedValue(false)
    const store = useNoteStore()
    expect(await store.hasNote()).toBe(false)
  })

  it('returns false when stored data is not encrypted', async () => {
    mockHasUserData.mockResolvedValue(true)
    mockFetchUserData.mockResolvedValue('plain-text')
    mockIsEncrypted.mockReturnValue(false)

    const store = useNoteStore()
    expect(await store.hasNote()).toBe(false)
  })

  it('returns false when fetchUserData returns null', async () => {
    mockHasUserData.mockResolvedValue(true)
    mockFetchUserData.mockResolvedValue(null)

    const store = useNoteStore()
    expect(await store.hasNote()).toBe(false)
  })

  it('returns false when an error is thrown', async () => {
    mockHasUserData.mockRejectedValue(new Error('db error'))
    const store = useNoteStore()
    expect(await store.hasNote()).toBe(false)
  })
})

describe('noteStore.clearNote', () => {
  it('calls deleteUserData and clears error', async () => {
    const store = useNoteStore()
    store.error = 'some error'
    await store.clearNote()

    expect(mockDeleteUserData).toHaveBeenCalledWith('note')
    expect(store.error).toBeNull()
  })

  it('clears error even when deleteUserData throws', async () => {
    mockDeleteUserData.mockRejectedValue(new Error('delete failed'))
    const store = useNoteStore()
    store.error = 'existing error'
    await store.clearNote()

    expect(store.error).toBeNull()
  })
})

describe('noteStore.clearNoteText', () => {
  it('resets noteText to empty string', () => {
    const store = useNoteStore()
    store.noteText = 'some text'
    store.clearNoteText()
    expect(store.noteText).toBe('')
  })
})
