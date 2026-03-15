// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockInitSession = vi.fn()

const authState = {
  isInitialized: true,
  isAuthenticated: false,
  hasSupabaseSession: false,
  initSession: mockInitSession,
}

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => authState,
}))

import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>Note</div>' }, meta: { requiresAuth: true } },
    { path: '/login', component: { template: '<div>Login</div>' } },
    { path: '/unlock', component: { template: '<div>Unlock</div>' } },
    { path: '/settings', component: { template: '<div>Settings</div>' }, meta: { requiresAuth: true } },
    { path: '/about', component: { template: '<div>About</div>' } },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.isInitialized) {
    await authStore.initSession()
  }

  if (authStore.isAuthenticated) {
    if (to.path === '/login' || to.path === '/unlock') {
      return '/'
    }
    return
  }

  if (to.meta.requiresAuth) {
    if (authStore.hasSupabaseSession) {
      return '/unlock'
    }
    return '/login'
  }

  if (to.path === '/unlock' && !authStore.hasSupabaseSession) {
    return '/login'
  }
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  authState.isInitialized = true
  authState.isAuthenticated = false
  authState.hasSupabaseSession = false
  mockInitSession.mockResolvedValue(undefined)
})

describe('router navigation guard', () => {
  it('redirects to /login when not authenticated and no session and requiresAuth', async () => {
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('redirects to /unlock when not authenticated but session exists and requiresAuth', async () => {
    authState.hasSupabaseSession = true
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/unlock')
  })

  it('allows access to requiresAuth route when authenticated', async () => {
    authState.isAuthenticated = true
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects /login to / when already authenticated', async () => {
    authState.isAuthenticated = true
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects /unlock to / when already authenticated', async () => {
    authState.isAuthenticated = true
    await router.push('/unlock')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects /unlock to /login when no session', async () => {
    authState.hasSupabaseSession = false
    await router.push('/unlock')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('allows /about without authentication', async () => {
    await router.push('/about')
    expect(router.currentRoute.value.path).toBe('/about')
  })

  it('calls initSession when store is not yet initialized', async () => {
    authState.isInitialized = false
    mockInitSession.mockImplementation(async () => {
      authState.isInitialized = true
    })

    await router.push('/login')
    expect(mockInitSession).toHaveBeenCalled()
  })

  it('does not call initSession when store is already initialized', async () => {
    authState.isInitialized = true
    await router.push('/about')
    expect(mockInitSession).not.toHaveBeenCalled()
  })

  it('allows access to /settings when authenticated', async () => {
    authState.isAuthenticated = true
    await router.push('/settings')
    expect(router.currentRoute.value.path).toBe('/settings')
  })
})
