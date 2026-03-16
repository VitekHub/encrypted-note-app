import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useSettingsStore } from './settingsStore'
import { useNoteStore } from './noteStore'
import {
  signUp,
  signIn,
  signOut,
  deleteAccount,
  getCurrentSession,
  deriveAuthToken,
} from '../utils/auth/usernameAuthService'
import { supabase } from '../lib/supabase'
import { loginLockoutService, LockoutError } from '../utils/loginLockoutService'

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
      await settingsStore.setArgon2Params(params)
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
      await loginLockoutService.checkLockout()

      const uid = await signIn(usernameInput, password)
      userId.value = uid
      username.value = usernameInput.toLowerCase()

      const { masterKey: key, params } = await cryptoService.unlock(password)
      masterKey.value = key

      await loginLockoutService.reset()

      const settingsStore = useSettingsStore()
      await settingsStore.loadSettings()
      await settingsStore.setArgon2Params(params)
      await useNoteStore().loadNote()
    } catch (e) {
      if (e instanceof LockoutError) {
        error.value = e.message
        throw e
      }
      if ((e as { code?: string })?.code?.includes('invalid_credentials')) {
        await loginLockoutService.recordFailedAttempt()
      }
      masterKey.value = null
      error.value = e instanceof Error && e.message ? e.message : 'Failed to unlock'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function lock(): Promise<void> {
    cryptoService.clear()
    masterKey.value = null
    error.value = null
    useSettingsStore().resetSettings()
    useNoteStore().clearNoteText()
  }

  async function logout(): Promise<void> {
    userId.value = null
    username.value = null
    keysExist.value = false
    await lock()
    await signOut()
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const currentUsername = username.value
    if (!currentUsername) throw new Error('Not authenticated')

    const oldAuthToken = await deriveAuthToken(currentUsername, oldPassword)
    const newAuthToken = await deriveAuthToken(currentUsername, newPassword)

    const { error: authError } = await supabase.auth.updateUser({ password: newAuthToken })
    if (authError) throw new Error(authError.message)

    try {
      await cryptoService.updatePassword(oldPassword, newPassword)
    } catch (cryptoError) {
      await supabase.auth.updateUser({ password: oldAuthToken })
      throw cryptoError
    }
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

    useSettingsStore().resetSettings()
    useNoteStore().clearNoteText()
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
    lock,
    logout,
    changePassword,
    teardown,
  }
})
