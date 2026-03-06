import { ref } from 'vue'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useSessionKeys } from './useSessionKeys'

export function useEncryptedNote(storageKey: string) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { masterKey } = useSessionKeys()

  // Create additional authenticated data: userId:fieldName. This binds the encryption to the specific user and field
  const userId = 'TODO'
  const fieldName = 'note'

  async function saveNote(plaintext: string): Promise<void> {
    if (!masterKey.value) {
      error.value = 'No active session key.'
      return
    }
    loading.value = true
    error.value = null
    try {
      const encrypted = await cryptoService.encrypt(plaintext, masterKey.value, fieldName, userId)
      localStorage.setItem(storageKey, encrypted)
    } catch {
      error.value = 'Failed to save note.'
    } finally {
      loading.value = false
    }
  }

  async function loadNote(): Promise<string | null> {
    if (!masterKey.value) {
      error.value = 'No active session key.'
      return null
    }
    loading.value = true
    error.value = null
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return null
      if (!cryptoService.isEncrypted(stored)) {
        error.value = 'Stored data is not in a valid encrypted format.'
        return null
      }
      return await cryptoService.decrypt(stored, masterKey.value, fieldName, userId)
    } catch {
      error.value = 'Wrong password or corrupted data.'
      return null
    } finally {
      loading.value = false
    }
  }

  function hasNote(): boolean {
    const stored = localStorage.getItem(storageKey)
    return stored !== null && cryptoService.isEncrypted(stored)
  }

  function clearNote(): void {
    localStorage.removeItem(storageKey)
    error.value = null
  }

  return { saveNote, loadNote, hasNote, clearNote, loading, error }
}
