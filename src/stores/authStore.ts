import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { cryptoService } from '../utils/crypto/cryptoService'
import { useSettingsStore } from './settingsStore'
import { useNoteStore } from './noteStore'
import {
  register,
  login,
  signOut,
  deleteAccount,
  getCurrentSession,
  changeSrpPassword,
} from '../utils/auth/usernameAuthService'
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
      await register(usernameInput, password)
      // srp-register creates the account but never authenticates the client;
      // login now to establish a session before the encrypted-key write.
      const uid = await login(usernameInput, password)
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

      const uid = await login(usernameInput, password)
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

    // Re-encrypt key material locally first (this also validates the old
    // password); then commit the new SRP verifier. If the server step fails,
    // roll the local re-encryption back so the account stays consistent.
    await cryptoService.updatePassword(oldPassword, newPassword)
    try {
      await changeSrpPassword(currentUsername, oldPassword, newPassword)
    } catch (e) {
      await cryptoService.updatePassword(newPassword, oldPassword)
      throw e
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
