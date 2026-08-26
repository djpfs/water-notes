import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '@/stores/app'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'splash',
      component: () => import('@/views/SplashView.vue'),
      meta: { public: true },
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { guest: true },
    },
    {
      path: '/meta',
      name: 'goal-reveal',
      component: () => import('@/views/GoalRevealView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/inicio',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/historico',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/ajustes',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const store = useAppStore()
  const onboarded = store.profile.onboarded

  if (to.meta.guest && onboarded) {
    return { name: 'home' }
  }

  if (to.meta.requiresAuth && !onboarded) {
    return { name: 'onboarding' }
  }

  return true
})

export default router
