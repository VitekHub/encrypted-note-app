import type * as UserKeyService from '../supabase/userKeyService'

export const store = new Map<string, string>()

export const mockUserKeyService: typeof UserKeyService = {
  fetchRsaPublicKey: () => Promise.resolve(store.get('rsa_public_key_spki') ?? null),
  saveRsaPublicKey: (value: string) => {
    store.set('rsa_public_key_spki', value)
    return Promise.resolve()
  },
  fetchRsaPrivateKeyEncrypted: () => Promise.resolve(store.get('rsa_private_key_encrypted') ?? null),
  saveRsaPrivateKeyEncrypted: (value: string) => {
    store.set('rsa_private_key_encrypted', value)
    return Promise.resolve()
  },
  fetchRsaKeyVersion: () => Promise.resolve(store.get('rsa_key_version') ?? null),
  saveRsaKeyVersion: (value: string) => {
    store.set('rsa_key_version', value)
    return Promise.resolve()
  },
  fetchWrappedMasterKey: () => Promise.resolve(store.get('wrapped_master_key') ?? null),
  saveWrappedMasterKey: (value: string) => {
    store.set('wrapped_master_key', value)
    return Promise.resolve()
  },
  deleteUserKeysRow: () => {
    store.clear()
    return Promise.resolve()
  },
}
