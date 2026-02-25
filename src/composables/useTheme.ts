import { ref, watchEffect } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'app-theme'

const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')

let mediaQuery: MediaQueryList | null = null

function applyTheme(m: ThemeMode) {
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

function onSystemChange(e: MediaQueryListEvent) {
  if (mode.value === 'system') {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
  }
}

watchEffect(() => {
  const m = mode.value
  localStorage.setItem(STORAGE_KEY, m)
  applyTheme(m)

  if (mediaQuery) {
    mediaQuery.removeEventListener('change', onSystemChange)
  }

  if (m === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', onSystemChange)
  }
})

export function useTheme() {
  function setMode(m: ThemeMode) {
    mode.value = m
  }

  return { mode, setMode }
}
