import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../pages/NotePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      component: () => import('../pages/LoginPage.vue'),
    },
    {
      path: '/unlock',
      component: () => import('../pages/UnlockPage.vue'),
    },
    {
      path: '/settings',
      component: () => import('../pages/SettingsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/about',
      component: () => import('../pages/AboutPage.vue'),
    },
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

export default router
