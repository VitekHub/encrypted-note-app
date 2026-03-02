export const store = new Map<string, string>()

export const mockCryptoKeyStorage = {
  get: (key: string) => Promise.resolve(store.get(key)),
  set: (key: string, value: string) => {
    store.set(key, value)
    return Promise.resolve()
  },
  delete: (key: string) => {
    store.delete(key)
    return Promise.resolve()
  },
  has: (key: string) => Promise.resolve(store.has(key)),
}
