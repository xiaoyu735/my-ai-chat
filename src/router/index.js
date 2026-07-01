import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

let authInitialized = false

router.beforeEach(async (to) => {
  const userStore = useUserStore()

  if (!authInitialized) {
    if (userStore.token) {
      await userStore.checkAuth()
    }
    authInitialized = true
  }

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { path: '/login' }
  }

  if (to.path === '/login' && userStore.isLoggedIn) {
    return { path: '/chat' }
  }
})

export default router
