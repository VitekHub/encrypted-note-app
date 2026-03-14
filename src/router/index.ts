import { createRouter, createWebHistory } from 'vue-router'
import { useSessionKeys } from '../composables/useSessionKeys'

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
  const { hasMasterKey } = useSessionKeys()

  if (to.meta.requiresAuth && !hasMasterKey.value) {
    return '/unlock'
  }

  if (to.path === '/unlock' && hasMasterKey.value) {
    return '/'
  }
})

export default router
