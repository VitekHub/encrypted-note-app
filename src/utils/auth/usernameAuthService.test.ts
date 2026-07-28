import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../supabase/supabaseMock'

let supabaseMock = createSupabaseMock()

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return supabaseMock
  },
}))

vi.mock('secure-remote-password/client', () => ({
  generateSalt: () => 'SALT',
  derivePrivateKey: (salt: string, username: string, password: string) => `PK(${salt}|${username}|${password})`,
  deriveVerifier: (privateKey: string) => `V(${privateKey})`,
  generateEphemeral: () => ({ secret: 'A_SECRET', public: 'A_PUBLIC' }),
  deriveSession: vi.fn(() => ({ key: 'K', proof: 'M1' })),
  verifySession: vi.fn(() => undefined),
}))

import * as srpClient from 'secure-remote-password/client'
import {
  validateUsername,
  register,
  login,
  changeSrpPassword,
  signOut,
  deleteAccount,
  getCurrentSession,
  isUsernameAvailable,
} from './usernameAuthService'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  supabaseMock = createSupabaseMock()
  vi.clearAllMocks()
  vi.mocked(srpClient.deriveSession).mockReturnValue({ key: 'K', proof: 'M1' } as srpClient.Session)
  vi.mocked(srpClient.verifySession).mockReturnValue(undefined)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
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

describe('register', () => {
  it('sends the locally derived salt and verifier to srp-register', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { userId: 'uid-1' }))

    await register('Alice', 'password123')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toEqual(expect.stringContaining('/functions/v1/srp-register'))
    const sent = JSON.parse((init as RequestInit).body as string)
    expect(sent).toMatchObject({ username: 'alice', salt: 'SALT' })
    expect(sent.verifier).toBe('V(PK(SALT|alice|password123))')
  })

  it('returns the user id on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { userId: 'uid-42' }))
    expect(await register('alice', 'password123')).toBe('uid-42')
  })

  it('throws a user-friendly error when the server rejects registration', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: 'Username already taken.' }))
    await expect(register('alice', 'password123')).rejects.toThrow('Username already taken.')
  })

  it('throws when the server returns no user id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await expect(register('alice', 'password123')).rejects.toThrow('no user id')
  })
})

describe('login', () => {
  function mockInit(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(jsonResponse(status, body))
  }
  function mockVerify(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(jsonResponse(status, body))
  }

  it('completes the handshake and establishes a session', async () => {
    mockInit(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' })
    mockVerify(200, { M2: 'M2', access_token: 'access', refresh_token: 'refresh' })
    supabaseMock.auth.setSession.mockResolvedValue({ data: { user: { id: 'uid-9' } }, error: null })

    const id = await login('Alice', 'password123')

    expect(id).toBe('uid-9')
    expect(supabaseMock.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    })
    expect(srpClient.verifySession).toHaveBeenCalled()
  })

  it('sends A and M1 to srp-login-verify', async () => {
    mockInit(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' })
    mockVerify(200, { M2: 'M2', access_token: 'access', refresh_token: 'refresh' })
    supabaseMock.auth.setSession.mockResolvedValue({ data: { user: { id: 'uid-9' } }, error: null })

    await login('alice', 'password123')

    const verifyCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('srp-login-verify'))
    expect(verifyCall).toBeDefined()
    const sent = JSON.parse((verifyCall![1] as RequestInit).body as string)
    expect(sent).toEqual({ sessionId: 'sess-1', A: 'A_PUBLIC', M1: 'M1' })
  })

  it('throws invalid_credentials when the account is unknown (init 404)', async () => {
    mockInit(404, { error: 'Invalid credentials.' })
    await expect(login('alice', 'password')).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('throws invalid_credentials when deriving the session fails', async () => {
    mockInit(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' })
    vi.mocked(srpClient.deriveSession).mockImplementation(() => {
      throw new Error('bad B')
    })
    await expect(login('alice', 'password')).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('throws invalid_credentials when the proof is rejected (verify 401)', async () => {
    mockInit(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' })
    mockVerify(401, { error: 'Invalid credentials.' })
    await expect(login('alice', 'wrong')).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('throws when the server proof M2 cannot be verified', async () => {
    mockInit(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' })
    mockVerify(200, { M2: 'bad', access_token: 'access', refresh_token: 'refresh' })
    vi.mocked(srpClient.verifySession).mockImplementation(() => {
      throw new Error('mismatch')
    })
    await expect(login('alice', 'password')).rejects.toThrow('Server authentication failed.')
  })

  it('throws when the session cannot be established', async () => {
    mockInit(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' })
    mockVerify(200, { M2: 'M2', access_token: 'access', refresh_token: 'refresh' })
    supabaseMock.auth.setSession.mockResolvedValue({ data: { user: null }, error: { message: 'nope' } })
    await expect(login('alice', 'password')).rejects.toThrow('could not establish session')
  })
})

describe('changeSrpPassword', () => {
  beforeEach(() => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'uid-1' }, access_token: 'jwt-token' } },
    })
  })

  it('proves the old password then sends new credentials with the session token', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))

    await changeSrpPassword('Alice', 'oldPass', 'newPass')

    const changeCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('srp-change-password'))
    expect(changeCall).toBeDefined()
    const headers = (changeCall![1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-token')
    const sent = JSON.parse((changeCall![1] as RequestInit).body as string)
    expect(sent).toMatchObject({ sessionId: 'sess-1', A: 'A_PUBLIC', M1: 'M1', salt: 'SALT' })
    expect(sent.verifier).toBe('V(PK(SALT|alice|newPass))')
  })

  it('throws invalid_credentials when the old password proof fails (401)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Invalid credentials.' }))

    await expect(changeSrpPassword('alice', 'wrong', 'newPass')).rejects.toMatchObject({
      code: 'invalid_credentials',
    })
  })

  it('throws when there is no active session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sessionId: 'sess-1', salt: 'SALT', B: 'B_PUBLIC' }))
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })

    await expect(changeSrpPassword('alice', 'old', 'new')).rejects.toThrow('no active session')
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
