import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './supabaseMock'

let supabaseMock = createSupabaseMock()

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return supabaseMock
  },
}))

import {
  fetchRsaPublicKey,
  saveRsaPublicKey,
  fetchRsaPrivateKeyEncrypted,
  saveRsaPrivateKeyEncrypted,
  fetchRsaKeyVersion,
  saveRsaKeyVersion,
  fetchWrappedMasterKey,
  saveWrappedMasterKey,
  deleteUserKeysRow,
} from './userKeyService'

const SESSION = { user: { id: 'user-xyz' } }

beforeEach(() => {
  supabaseMock = createSupabaseMock({ session: SESSION })
})

describe('fetchRsaPublicKey', () => {
  it('returns the stored public key', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { rsa_public_key_spki: 'pubkey-base64' }, error: null })
    expect(await fetchRsaPublicKey()).toBe('pubkey-base64')
  })

  it('returns null when no row exists', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchRsaPublicKey()).toBeNull()
  })

  it('throws on DB error', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'db fail' } })
    await expect(fetchRsaPublicKey()).rejects.toThrow('Failed to fetch rsa_public_key_spki')
  })

  it('throws when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(fetchRsaPublicKey()).rejects.toThrow('No active Supabase session')
  })
})

describe('saveRsaPublicKey', () => {
  it('upserts to user_keys table', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: null })
    await saveRsaPublicKey('pubkey')

    expect(supabaseMock.from).toHaveBeenCalledWith('user_keys')
    expect(supabaseMock._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: SESSION.user.id, rsa_public_key_spki: 'pubkey' }),
      expect.objectContaining({ onConflict: 'user_id' })
    )
  })

  it('throws on upsert failure', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: { message: 'conflict' } })
    await expect(saveRsaPublicKey('pubkey')).rejects.toThrow('Failed to upsert user_keys')
  })
})

describe('fetchRsaPrivateKeyEncrypted', () => {
  it('returns the stored encrypted private key', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { rsa_private_key_encrypted: 'enc-priv' }, error: null })
    expect(await fetchRsaPrivateKeyEncrypted()).toBe('enc-priv')
  })

  it('returns null when no row exists', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchRsaPrivateKeyEncrypted()).toBeNull()
  })

  it('throws on DB error', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(fetchRsaPrivateKeyEncrypted()).rejects.toThrow('Failed to fetch rsa_private_key_encrypted')
  })
})

describe('saveRsaPrivateKeyEncrypted', () => {
  it('upserts the encrypted private key', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: null })
    await saveRsaPrivateKeyEncrypted('enc-blob')

    expect(supabaseMock._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ rsa_private_key_encrypted: 'enc-blob' }),
      expect.anything()
    )
  })
})

describe('fetchRsaKeyVersion', () => {
  it('returns the stored key version', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { rsa_key_version: 'rsa_v1' }, error: null })
    expect(await fetchRsaKeyVersion()).toBe('rsa_v1')
  })

  it('returns null when no row exists', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchRsaKeyVersion()).toBeNull()
  })

  it('throws on DB error', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(fetchRsaKeyVersion()).rejects.toThrow('Failed to fetch rsa_key_version')
  })
})

describe('saveRsaKeyVersion', () => {
  it('upserts the key version', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: null })
    await saveRsaKeyVersion('rsa_v1')

    expect(supabaseMock._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ rsa_key_version: 'rsa_v1' }),
      expect.anything()
    )
  })
})

describe('fetchWrappedMasterKey', () => {
  it('returns the stored wrapped master key', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: { wrapped_master_key: 'wrapped-key' }, error: null })
    expect(await fetchWrappedMasterKey()).toBe('wrapped-key')
  })

  it('returns null when no row exists', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchWrappedMasterKey()).toBeNull()
  })

  it('throws on DB error', async () => {
    supabaseMock._chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(fetchWrappedMasterKey()).rejects.toThrow('Failed to fetch wrapped_master_key')
  })
})

describe('saveWrappedMasterKey', () => {
  it('upserts the wrapped master key', async () => {
    supabaseMock._chain.upsert.mockResolvedValue({ error: null })
    await saveWrappedMasterKey('wrapped-key')

    expect(supabaseMock._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ wrapped_master_key: 'wrapped-key' }),
      expect.anything()
    )
  })
})

describe('deleteUserKeysRow', () => {
  it('calls delete on user_keys with the correct user_id', async () => {
    supabaseMock._chain.eq.mockResolvedValue({ error: null })

    await deleteUserKeysRow()

    expect(supabaseMock.from).toHaveBeenCalledWith('user_keys')
    expect(supabaseMock._chain.delete).toHaveBeenCalled()
    expect(supabaseMock._chain.eq).toHaveBeenCalledWith('user_id', SESSION.user.id)
  })

  it('throws on delete failure', async () => {
    supabaseMock._chain.eq.mockResolvedValue({ error: { message: 'delete failed' } })
    await expect(deleteUserKeysRow()).rejects.toThrow('Failed to delete user_keys row')
  })

  it('throws when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(deleteUserKeysRow()).rejects.toThrow('No active Supabase session')
  })
})
