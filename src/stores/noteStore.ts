import { ref } from 'vue'
import { defineStore } from 'pinia'
import { storeToRefs } from 'pinia'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useAuthStore } from './authStore'
import { fetchUserData, saveUserData, deleteUserData, hasUserData } from '../utils/supabase/userDataService'

const DATA_KEY = 'note'

export const useNoteStore = defineStore('note', () => {
  const noteText = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fieldName = 'note'

  function getAuthRefs() {
    const authStore = useAuthStore()
    const { masterKey, userId } = storeToRefs(authStore)
    return { masterKey, userId }
  }

  async function saveNote(plaintext: string): Promise<void> {
    const { masterKey, userId } = getAuthRefs()
    if (!masterKey.value || !userId.value) {
      error.value = 'No active session.'
      return
    }
    loading.value = true
    error.value = null
    try {
      const encrypted = await cryptoService.encrypt(plaintext, masterKey.value, fieldName, userId.value)
      await saveUserData(DATA_KEY, encrypted)
    } catch {
      error.value = 'Failed to save note.'
    } finally {
      loading.value = false
    }
  }

  async function loadNote(): Promise<string | null> {
    const { masterKey, userId } = getAuthRefs()
    if (!masterKey.value || !userId.value) {
      error.value = 'No active session.'
      return null
    }
    loading.value = true
    error.value = null
    try {
      const stored = await fetchUserData(DATA_KEY)
      if (!stored) return null
      if (!cryptoService.isEncrypted(stored)) {
        error.value = 'Stored data is not in a valid encrypted format.'
        return null
      }
      return await cryptoService.decrypt(stored, masterKey.value, fieldName, userId.value)
    } catch {
      error.value = 'Wrong password or corrupted data.'
      return null
    } finally {
      loading.value = false
    }
  }

  async function hasNote(): Promise<boolean> {
    try {
      const exists = await hasUserData(DATA_KEY)
      if (!exists) return false
      const stored = await fetchUserData(DATA_KEY)
      return stored !== null && cryptoService.isEncrypted(stored)
    } catch {
      return false
    }
  }

  async function clearNote(): Promise<void> {
    try {
      await deleteUserData(DATA_KEY)
    } catch {
      // best-effort
    }
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
