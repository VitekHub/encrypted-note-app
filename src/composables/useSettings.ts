import { ref, watch } from 'vue'
import type { Argon2Params } from '../utils/crypto/keys/symmetric/passwordDerived'

export interface AppSettings {
  idleTimeoutMinutes: number
  argon2Params?: Argon2Params
}

const SETTINGS_KEY = 'app-settings'

const defaultSettings: AppSettings = {
  idleTimeoutMinutes: 5, // 5 minutes default
}

let initialSettings = { ...defaultSettings }
try {
  const stored = localStorage.getItem(SETTINGS_KEY)
  if (stored) {
    initialSettings = { ...defaultSettings, ...JSON.parse(stored) }
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Failed to parse app settings from localStorage', e)
}

const settings = ref<AppSettings>(initialSettings)

watch(
  settings,
  (newVal) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newVal))
  },
  { deep: true }
)

export function useSettings() {
  return {
    settings,
  }
}
