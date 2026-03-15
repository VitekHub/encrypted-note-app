// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from './themeStore'

function createMatchMediaMock(prefersDark: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = []
  const mql = {
    matches: prefersDark,
    addEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn)),
    removeEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(fn)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    dispatchChange: (matches: boolean) => {
      listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent))
    },
  }
  return mql
}

let mql: ReturnType<typeof createMatchMediaMock>

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  mql = createMatchMediaMock(false)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('themeStore', () => {
  it('defaults to system mode when localStorage is empty', () => {
    const store = useThemeStore()
    expect(store.mode).toBe('system')
  })

  it('restores mode from localStorage', () => {
    localStorage.setItem('app-theme', 'dark')
    mql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    const store = useThemeStore()
    expect(store.mode).toBe('dark')
  })

  it('setMode("light") sets data-theme="light" on <html>', async () => {
    const store = useThemeStore()
    store.setMode('light')
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setMode("dark") sets data-theme="dark" on <html>', async () => {
    const store = useThemeStore()
    store.setMode('dark')
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('setMode("system") follows system preference (light)', async () => {
    mql.matches = false
    const store = useThemeStore()
    store.setMode('system')
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setMode("system") follows system preference (dark)', async () => {
    mql.matches = true
    const store = useThemeStore()
    store.setMode('system')
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists the mode to localStorage on change', async () => {
    const store = useThemeStore()
    store.setMode('dark')
    await nextTick()
    expect(localStorage.getItem('app-theme')).toBe('dark')
  })

  it('updates theme when system preference changes while in system mode', async () => {
    const store = useThemeStore()
    store.setMode('system')
    await nextTick()

    mql.dispatchChange(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    mql.dispatchChange(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('does not react to system preference changes after switching away from system mode', async () => {
    const store = useThemeStore()
    store.setMode('system')
    await nextTick()
    store.setMode('light')
    await nextTick()

    mql.dispatchChange(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('removes the media query listener when switching away from system mode', async () => {
    const store = useThemeStore()
    store.setMode('system')
    await nextTick()
    store.setMode('dark')
    await nextTick()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })
})
