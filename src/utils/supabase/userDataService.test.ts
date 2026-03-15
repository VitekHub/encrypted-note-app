import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './supabaseMock'

let supabaseMock = createSupabaseMock()

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return supabaseMock
  },
}))

import { fetchUserData, saveUserData, deleteUserData, hasUserData } from './userDataService'

const SESSION = { user: { id: 'user-abc' } }

beforeEach(() => {
  supabaseMock = createSupabaseMock({ session: SESSION })
})

describe('fetchUserData', () => {
  it('returns the stored value', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { data_value: 'hello' }, error: null })
    expect(await fetchUserData('note')).toBe('hello')
  })

  it('returns null when no row exists', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchUserData('note')).toBeNull()
  })

  it('queries the correct table, user_id, and data_key', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await fetchUserData('settings')

    expect(supabaseMock.from).toHaveBeenCalledWith('user_data')
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith('user_id', SESSION.user.id)
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith('data_key', 'settings')
  })

  it('throws when query fails', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } })
    await expect(fetchUserData('note')).rejects.toThrow('Failed to fetch data "note"')
  })

  it('throws when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(fetchUserData('note')).rejects.toThrow('No active Supabase session')
  })
})

describe('saveUserData', () => {
  it('upserts to the correct table with correct payload', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: null })
    await saveUserData('note', 'encrypted-value')

    expect(supabaseMock.from).toHaveBeenCalledWith('user_data')
    expect(supabaseMock._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: SESSION.user.id,
        data_key: 'note',
        data_value: 'encrypted-value',
      }),
      expect.objectContaining({ onConflict: 'user_id,data_key' })
    )
  })

  it('throws when upsert fails', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: { message: 'conflict' } })
    await expect(saveUserData('note', 'val')).rejects.toThrow('Failed to save data "note"')
  })

  it('throws when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(saveUserData('note', 'val')).rejects.toThrow('No active Supabase session')
  })
})

describe('deleteUserData', () => {
  it('calls delete with the correct filters', async () => {
    supabaseMock._chain.eq.mockReturnValueOnce(supabaseMock._chain)
    supabaseMock._chain.eq.mockResolvedValueOnce({ error: null })

    await deleteUserData('note')

    expect(supabaseMock.from).toHaveBeenCalledWith('user_data')
    expect(supabaseMock._chain.delete).toHaveBeenCalled()
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith('user_id', SESSION.user.id)
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith('data_key', 'note')
  })

  it('throws when delete fails', async () => {
    supabaseMock._chain.eq.mockReturnValueOnce(supabaseMock._chain)
    supabaseMock._chain.eq.mockResolvedValueOnce({ error: { message: 'delete error' } })

    await expect(deleteUserData('note')).rejects.toThrow('Failed to delete data "note"')
  })

  it('throws when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(deleteUserData('note')).rejects.toThrow('No active Supabase session')
  })
})

describe('hasUserData', () => {
  it('returns true when data exists', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { data_value: 'something' }, error: null })
    expect(await hasUserData('note')).toBe(true)
  })

  it('returns false when data is null', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await hasUserData('note')).toBe(false)
  })
})
