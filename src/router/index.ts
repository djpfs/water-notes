import { createRouter, createWebHistory } from 'vue-router'
import { clearAuthCache, fetchMe } from '@/composables/useCloudSync'
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
      path: '/entrar',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { requiresLogin: true, guestOnboard: true },
    },
    {
      path: '/meta',
      name: 'goal-reveal',
      component: () => import('@/views/GoalRevealView.vue'),
      meta: { requiresLogin: true, requiresOnboard: true },
    },
    {
      path: '/inicio',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresLogin: true, requiresOnboard: true },
    },
    {
      path: '/historico',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { requiresLogin: true, requiresOnboard: true },
    },
    {
      path: '/ajustes',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresLogin: true, requiresOnboard: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const store = useAppStore()

  if (to.meta.public) return true

  const user = await fetchMe()
  if (!user) {
    clearAuthCache()
    return { name: 'login' }
  }

  store.applyGoogleAccount({
    name: user.name,
    email: user.email,
    picture: user.picture,
  })

  if (to.meta.guestOnboard && store.profile.onboarded) {
    return { name: 'home' }
  }

  if (to.meta.requiresOnboard && !store.profile.onboarded) {
    return { name: 'onboarding' }
  }

  return true
})

export default router
