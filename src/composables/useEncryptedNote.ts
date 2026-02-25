import { ref } from 'vue'
import { encryptField, decryptField, isEncrypted } from '../utils/crypto/encryption'

export function useEncryptedNote(storageKey: string) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // Create additional authenticated data: userId:fieldName. This binds the encryption to the specific user and field
  const userId = 'TODO'
  const fieldName = 'note'
  const aad = `${userId}:${fieldName}`

  async function saveNote(plaintext: string, password: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const encrypted = await encryptField(plaintext, password, aad)
      localStorage.setItem(storageKey, encrypted)
    } catch (e) {
      error.value = 'Failed to save note.'
    } finally {
      loading.value = false
    }
  }

  async function loadNote(password: string): Promise<string | null> {
    loading.value = true
    error.value = null
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return null
      if (!isEncrypted(stored)) {
        error.value = 'Stored data is not in a valid encrypted format.'
        return null
      }
      return await decryptField(stored, password, aad)
    } catch (e) {
      error.value = 'Wrong password or corrupted data.'
      return null
    } finally {
      loading.value = false
    }
  }

  function hasNote(): boolean {
    const stored = localStorage.getItem(storageKey)
    return stored !== null && isEncrypted(stored)
  }

  function dropDatabase(): void {
    localStorage.removeItem(storageKey)
    error.value = null
  }

  return { saveNote, loadNote, hasNote, dropDatabase, loading, error }
}
