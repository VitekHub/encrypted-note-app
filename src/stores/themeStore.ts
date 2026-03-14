import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'app-theme'

let mediaQuery: MediaQueryList | null = null

function applyTheme(m: ThemeMode): void {
  const html = document.documentElement
  if (m === 'light') {
    html.setAttribute('data-theme', 'light')
  } else if (m === 'dark') {
    html.setAttribute('data-theme', 'dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  }
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')

  function onSystemChange(e: MediaQueryListEvent): void {
    if (mode.value === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    }
  }

  watch(
    mode,
    (m) => {
      localStorage.setItem(STORAGE_KEY, m)
      applyTheme(m)

      if (mediaQuery) {
        mediaQuery.removeEventListener('change', onSystemChange)
      }

      if (m === 'system') {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addEventListener('change', onSystemChange)
      }
    },
    { immediate: true }
  )

  function setMode(m: ThemeMode): void {
    mode.value = m
  }

  return {
    mode,
    setMode,
  }
})
