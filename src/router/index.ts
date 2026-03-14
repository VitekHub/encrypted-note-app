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

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/unlock'
  }

  if (to.path === '/unlock' && authStore.isAuthenticated) {
    return '/'
  }
})

export default router
