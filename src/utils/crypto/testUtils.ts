import type * as UserKeyService from '../supabase/userKeyService'

export const store = new Map<string, string>()

export const mockUserKeyService: typeof UserKeyService = {
  getRsaPublicKey: () => Promise.resolve(store.get('rsa_public_key_spki') ?? null),
  setRsaPublicKey: (value: string) => {
    store.set('rsa_public_key_spki', value)
    return Promise.resolve()
  },
  getRsaPrivateKeyEncrypted: () => Promise.resolve(store.get('rsa_private_key_encrypted') ?? null),
  setRsaPrivateKeyEncrypted: (value: string) => {
    store.set('rsa_private_key_encrypted', value)
    return Promise.resolve()
  },
  getRsaKeyVersion: () => Promise.resolve(store.get('rsa_key_version') ?? null),
  setRsaKeyVersion: (value: string) => {
    store.set('rsa_key_version', value)
    return Promise.resolve()
  },
  getWrappedMasterKey: () => Promise.resolve(store.get('wrapped_master_key') ?? null),
  setWrappedMasterKey: (value: string) => {
    store.set('wrapped_master_key', value)
    return Promise.resolve()
  },
  deleteUserKeysRow: () => {
    store.clear()
    return Promise.resolve()
  },
}
