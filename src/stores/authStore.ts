import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useSettingsStore } from './settingsStore'
import { useNoteStore } from './noteStore'

export const useAuthStore = defineStore('auth', () => {
  const masterKey = ref<CryptoKey | null>(null)
  const keysExist = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => masterKey.value !== null)

  async function checkKeysExist(): Promise<void> {
    keysExist.value = await cryptoService.isSetUp()
  }

  async function setup(password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { masterKey: key, params } = await cryptoService.setup(password)
      masterKey.value = key
      keysExist.value = true
      const settingsStore = useSettingsStore()
      settingsStore.settings.argon2Params = params
    } catch (e) {
      error.value = e instanceof Error && e.message ? e.message : 'Failed to set up'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function unlock(password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { masterKey: key, params } = await cryptoService.unlock(password)
      masterKey.value = key
      const settingsStore = useSettingsStore()
      settingsStore.settings.argon2Params = params
    } catch (e) {
      error.value = e instanceof Error && e.message ? e.message : 'Failed to unlock'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function lock(): void {
    cryptoService.lock()
    masterKey.value = null
    error.value = null
    const settingsStore = useSettingsStore()
    settingsStore.resetSettings()
    const noteStore = useNoteStore()
    noteStore.clearNoteText()
  }

  async function teardown(): Promise<void> {
    masterKey.value = null
    await cryptoService.teardown()
    keysExist.value = false
    error.value = null
  }

  return {
    masterKey,
    keysExist,
    isLoading,
    error,
    isAuthenticated,
    checkKeysExist,
    setup,
    unlock,
    lock,
    teardown,
  }
})
