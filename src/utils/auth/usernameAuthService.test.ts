import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../supabase/supabaseMock'

let supabaseMock = createSupabaseMock()

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return supabaseMock
  },
}))

import {
  validateUsername,
  deriveAuthToken,
  signUp,
  signIn,
  signOut,
  deleteAccount,
  getCurrentSession,
  isUsernameAvailable,
} from './usernameAuthService'

beforeEach(() => {
  supabaseMock = createSupabaseMock()
})

describe('validateUsername', () => {
  it('returns no errors for a valid username', () => {
    expect(validateUsername('alice')).toEqual([])
    expect(validateUsername('Alice_123')).toEqual([])
  })

  it('errors when username is too short', () => {
    expect(validateUsername('ab')).toContainEqual('Minimum 3 characters')
  })

  it('errors when username is too long', () => {
    expect(validateUsername('a'.repeat(33))).toContainEqual('Maximum 32 characters')
  })

  it('errors when username contains disallowed characters', () => {
    expect(validateUsername('alice!')).toContainEqual('Only letters, numbers, and underscores')
    expect(validateUsername('alice space')).toContainEqual('Only letters, numbers, and underscores')
  })

  it('returns multiple errors when multiple rules fail', () => {
    const errors = validateUsername('a!')
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('deriveAuthToken', () => {
  it('is deterministic for the same inputs', async () => {
    const t1 = await deriveAuthToken('alice', 'password123')
    const t2 = await deriveAuthToken('alice', 'password123')
    expect(t1).toBe(t2)
  })

  it('produces different tokens for different passwords', async () => {
    const t1 = await deriveAuthToken('alice', 'password123')
    const t2 = await deriveAuthToken('alice', 'different')
    expect(t1).not.toBe(t2)
  })

  it('lowercases the username before hashing', async () => {
    const lower = await deriveAuthToken('alice', 'pass')
    const upper = await deriveAuthToken('ALICE', 'pass')
    expect(lower).toBe(upper)
  })

  it('returns a 64-char hex string (Argon2id, 32-byte hash)', async () => {
    const token = await deriveAuthToken('alice', 'pass')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('signUp', () => {
  it('calls supabase.auth.signUp with a synthetic email', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    supabaseMock._chain.insert.mockResolvedValue({ error: null })

    await signUp('Alice', 'password123')

    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'alice@ciphernote.local' }))
  })

  it('uses the derived auth token as the Supabase password', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    supabaseMock._chain.insert.mockResolvedValue({ error: null })

    const expectedToken = await deriveAuthToken('alice', 'password123')
    await signUp('Alice', 'password123')

    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ password: expectedToken }))
  })

  it('returns the user id on success', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'uid-42' } }, error: null })
    supabaseMock._chain.insert.mockResolvedValue({ error: null })

    const id = await signUp('alice', 'password123')
    expect(id).toBe('uid-42')
  })

  it('inserts a profile row with the lowercased username', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    supabaseMock._chain.insert.mockResolvedValue({ error: null })

    await signUp('Alice', 'password123')

    expect(supabaseMock.from).toHaveBeenCalledWith('profiles')
    expect(supabaseMock._chain.insert).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice' }))
  })

  it('throws a user-friendly error when username is already taken', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    })

    await expect(signUp('alice', 'password123')).rejects.toThrow('Username already taken.')
  })

  it('throws when profile insert fails', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    supabaseMock._chain.insert.mockResolvedValue({ error: { message: 'unique violation' } })

    await expect(signUp('alice', 'password123')).rejects.toThrow('Failed to create profile')
  })

  it('throws when signUp returns no user', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: null }, error: null })

    await expect(signUp('alice', 'password123')).rejects.toThrow('Sign up failed')
  })
})

describe('signIn', () => {
  it('returns the user id on success', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'uid-99' } }, error: null })

    const id = await signIn('alice', 'password123')
    expect(id).toBe('uid-99')
  })

  it('uses the derived auth token', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })

    const expectedToken = await deriveAuthToken('alice', 'password123')
    await signIn('Alice', 'password123')

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@ciphernote.local', password: expectedToken })
    )
  })

  it('re-throws the original error when code is invalid_credentials', async () => {
    const originalError = { message: 'Invalid login credentials', code: 'invalid_credentials' }
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: originalError })

    await expect(signIn('alice', 'wrong')).rejects.toMatchObject(originalError)
  })

  it('wraps other errors in a generic message', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'some server error', code: 'server_error' },
    })

    await expect(signIn('alice', 'pass')).rejects.toThrow('Sign in failed')
  })

  it('throws when signIn returns no user', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null })

    await expect(signIn('alice', 'pass')).rejects.toThrow('Sign in failed')
  })
})

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    await signOut()
    expect(supabaseMock.auth.signOut).toHaveBeenCalled()
  })

  it('throws when signOut fails', async () => {
    supabaseMock.auth.signOut.mockResolvedValue({ error: { message: 'sign out failed' } })
    await expect(signOut()).rejects.toThrow('Sign out failed')
  })
})

describe('deleteAccount', () => {
  it('calls supabase.rpc("delete_own_account")', async () => {
    await deleteAccount()
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_own_account')
  })

  it('throws when RPC fails', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    await expect(deleteAccount()).rejects.toThrow('Failed to delete account')
  })
})

describe('getCurrentSession', () => {
  it('returns null when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
    expect(await getCurrentSession()).toBeNull()
  })

  it('returns null when the profile is not found', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'uid-1' } } },
    })
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })

    expect(await getCurrentSession()).toBeNull()
  })

  it('returns userId and username when session and profile exist', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'uid-1' } } },
    })
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { username: 'alice' }, error: null })

    const result = await getCurrentSession()
    expect(result).toEqual({ userId: 'uid-1', username: 'alice' })
  })
})

describe('isUsernameAvailable', () => {
  it('returns true when RPC returns true', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: true, error: null })
    expect(await isUsernameAvailable('alice')).toBe(true)
  })

  it('returns false when RPC returns false', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: false, error: null })
    expect(await isUsernameAvailable('alice')).toBe(false)
  })

  it('throws when RPC fails', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'rpc error' } })
    await expect(isUsernameAvailable('alice')).rejects.toThrow('Username check failed')
  })
})
