<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchMe } from '@/composables/useCloudSync'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()
const { t } = useI18n()

onMounted(() => {
  window.setTimeout(async () => {
    const user = await fetchMe(true)
    if (user) {
      store.applyGoogleAccount({
        name: user.name,
        email: user.email,
        picture: user.picture,
      })
    }
    if (store.profile.onboarded) {
      await router.replace({ name: 'home' })
    } else {
      await router.replace({ name: 'onboarding' })
    }
  }, 900)
})
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col items-center justify-center px-6">
    <div class="splash-mark flex flex-col items-center">
      <div class="relative mb-6 flex h-24 w-24 items-center justify-center">
        <span class="ripple absolute inset-0 rounded-full bg-teal/20" />
        <span class="ripple ripple-delay absolute inset-2 rounded-full bg-teal/25" />
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path
            d="M32 8c0 0-16 20-16 32a16 16 0 0032 0c0-12-16-32-16-32z"
            class="fill-teal"
          />
          <ellipse cx="26" cy="36" rx="4" ry="7" class="fill-water" opacity="0.75" />
        </svg>
      </div>
      <h1 class="font-display text-3xl font-bold tracking-tight text-ink">Water Notes</h1>
      <p class="mt-2 text-sm text-ink-soft">{{ t('splash.tagline') }}</p>
    </div>
  </main>
</template>

<style scoped>
.splash-mark {
  animation: rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ripple {
  animation: pulse 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.ripple-delay {
  animation-delay: 0.35s;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0% {
    transform: scale(0.85);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}
</style>
