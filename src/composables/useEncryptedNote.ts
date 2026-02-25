import { ref } from 'vue'
import { encryptField, decryptField } from '../utils/crypto/simpleEncryption'

export function useEncryptedNote(storageKey: string) {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function saveNote(plaintext: string, password: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const encrypted = await encryptField(plaintext, password)
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
      return await decryptField(stored, password)
    } catch (e) {
      error.value = 'Wrong password or corrupted data.'
      return null
    } finally {
      loading.value = false
    }
  }

  function hasNote(): boolean {
    return localStorage.getItem(storageKey) !== null
  }

  return { saveNote, loadNote, hasNote, loading, error }
}
