import { ref } from 'vue'
import { defineStore } from 'pinia'
import { storeToRefs } from 'pinia'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useAuthStore } from './authStore'

const STORAGE_KEY = 'app-note'

export const useNoteStore = defineStore('note', () => {
  const noteText = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const userId = 'TODO'
  const fieldName = 'note'

  function getAuthStore() {
    const authStore = useAuthStore()
    const { masterKey } = storeToRefs(authStore)
    return masterKey
  }

  async function saveNote(plaintext: string): Promise<void> {
    const masterKey = getAuthStore()
    if (!masterKey.value) {
      error.value = 'No active session key.'
      return
    }
    loading.value = true
    error.value = null
    try {
      const encrypted = await cryptoService.encrypt(plaintext, masterKey.value, fieldName, userId)
      localStorage.setItem(STORAGE_KEY, encrypted)
    } catch {
      error.value = 'Failed to save note.'
    } finally {
      loading.value = false
    }
  }

  async function loadNote(): Promise<string | null> {
    const masterKey = getAuthStore()
    if (!masterKey.value) {
      error.value = 'No active session key.'
      return null
    }
    loading.value = true
    error.value = null
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
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
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== null && cryptoService.isEncrypted(stored)
  }

  function clearNote(): void {
    localStorage.removeItem(STORAGE_KEY)
    error.value = null
  }

  function clearNoteText(): void {
    noteText.value = ''
  }

  return {
    noteText,
    loading,
    error,
    saveNote,
    loadNote,
    hasNote,
    clearNote,
    clearNoteText,
  }
})
