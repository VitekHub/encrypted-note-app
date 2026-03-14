import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useSettingsStore } from './settingsStore'
import { useNoteStore } from './noteStore'
import { signUp, signIn, signOut, deleteAccount, getCurrentSession } from '../utils/auth/usernameAuthService'

export const useAuthStore = defineStore('auth', () => {
  const masterKey = ref<CryptoKey | null>(null)
  const keysExist = ref(false)
  const isLoading = ref(false)
  const isInitialized = ref(false)
  const error = ref<string | null>(null)
  const username = ref<string | null>(null)
  const userId = ref<string | null>(null)

  const isAuthenticated = computed(() => masterKey.value !== null)
  const hasSupabaseSession = computed(() => userId.value !== null)

  async function initSession(): Promise<void> {
    const session = await getCurrentSession()
    if (session) {
      userId.value = session.userId
      username.value = session.username
      keysExist.value = await cryptoService.isSetUp()
    } else {
      userId.value = null
      username.value = null
      keysExist.value = false
    }
    isInitialized.value = true
  }

  async function checkKeysExist(): Promise<void> {
    keysExist.value = await cryptoService.isSetUp()
  }

  async function setup(usernameInput: string, password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const uid = await signUp(usernameInput, password)
      userId.value = uid
      username.value = usernameInput.toLowerCase()

      const { masterKey: key, params } = await cryptoService.setup(password)
      masterKey.value = key
      keysExist.value = true

      const settingsStore = useSettingsStore()
      await settingsStore.loadSettings()
      await settingsStore.updateSettings({ argon2Params: params })
    } catch (e) {
      userId.value = null
      username.value = null
      error.value = e instanceof Error && e.message ? e.message : 'Failed to create account'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function unlock(usernameInput: string, password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const uid = await signIn(usernameInput, password)
      userId.value = uid
      username.value = usernameInput.toLowerCase()

      const { masterKey: key, params } = await cryptoService.unlock(password)
      masterKey.value = key

      const settingsStore = useSettingsStore()
      const storedParams = await settingsStore.loadSettings()
      if (!storedParams) {
        await settingsStore.updateSettings({ argon2Params: params })
      }
    } catch (e) {
      userId.value = null
      username.value = null
      masterKey.value = null
      error.value = e instanceof Error && e.message ? e.message : 'Failed to unlock'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function unlockExistingSession(password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { masterKey: key, params } = await cryptoService.unlock(password)
      masterKey.value = key

      const settingsStore = useSettingsStore()
      const storedParams = await settingsStore.loadSettings()
      if (!storedParams) {
        await settingsStore.updateSettings({ argon2Params: params })
      }
    } catch (e) {
      error.value = e instanceof Error && e.message ? e.message : 'Failed to unlock'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function lock(): Promise<void> {
    cryptoService.lock()
    masterKey.value = null
    error.value = null
    const settingsStore = useSettingsStore()
    settingsStore.resetSettings()
    const noteStore = useNoteStore()
    noteStore.clearNoteText()
  }

  async function logout(): Promise<void> {
    cryptoService.lock()
    masterKey.value = null
    error.value = null
    userId.value = null
    username.value = null
    keysExist.value = false

    const settingsStore = useSettingsStore()
    settingsStore.resetSettings()
    const noteStore = useNoteStore()
    noteStore.clearNoteText()

    await signOut()
  }

  async function teardown(): Promise<void> {
    await cryptoService.teardown()
    await deleteAccount()
    await signOut()

    masterKey.value = null
    keysExist.value = false
    error.value = null
    userId.value = null
    username.value = null

    const settingsStore = useSettingsStore()
    settingsStore.resetSettings()
    const noteStore = useNoteStore()
    noteStore.clearNoteText()
  }

  return {
    masterKey,
    keysExist,
    isLoading,
    isInitialized,
    error,
    username,
    userId,
    isAuthenticated,
    hasSupabaseSession,
    initSession,
    checkKeysExist,
    setup,
    unlock,
    unlockExistingSession,
    lock,
    logout,
    teardown,
  }
})
