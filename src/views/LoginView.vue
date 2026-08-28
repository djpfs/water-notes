<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchMe,
  pullAndMerge,
  startGoogleLogin,
} from '@/composables/useCloudSync'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { t } = useI18n()

const busy = ref(true)
const error = ref('')

async function finishAuthFlow() {
  const user = await fetchMe(true)
  if (!user) {
    busy.value = false
    return
  }

  store.applyGoogleAccount({
    name: user.name,
    email: user.email,
    picture: user.picture,
  })

  try {
    if (store.profile.onboarded) {
      await pullAndMerge()
      await router.replace({ name: 'home' })
      return
    }
    await router.replace({ name: 'onboarding' })
  } catch {
    if (store.profile.onboarded) {
      await router.replace({ name: 'home' })
    } else {
      await router.replace({ name: 'onboarding' })
    }
  }
}

onMounted(async () => {
  const auth = route.query.auth
  if (auth === 'error') {
    error.value = t('login.error')
    busy.value = false
    await router.replace({ name: 'login' })
    return
  }

  if (auth === 'ok') {
    await finishAuthFlow()
    return
  }

  const user = await fetchMe(true)
  if (user) {
    store.applyGoogleAccount({
      name: user.name,
      email: user.email,
      picture: user.picture,
    })
    if (store.profile.onboarded) {
      await router.replace({ name: 'home' })
    } else {
      await router.replace({ name: 'onboarding' })
    }
    return
  }

  busy.value = false
})
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5">
    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal/15">
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path
            d="M32 10c0 0-14 17-14 28a14 14 0 0028 0c0-11-14-28-14-28z"
            class="fill-teal"
          />
        </svg>
      </div>
      <h1 class="font-display text-3xl font-bold text-ink">Water Notes</h1>
      <p class="mt-2 max-w-xs text-sm text-ink-soft">
        {{ t('login.subtitle') }}
      </p>

      <p v-if="busy" class="mt-8 text-sm text-ink-soft">{{ t('common.loading') }}</p>

      <template v-else>
        <button
          type="button"
          class="mt-8 flex h-12 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-ink font-semibold text-surface-raised"
          @click="startGoogleLogin"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.1H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.5 6.6l6.2 5.2C38.5 36.6 44 31 44 24c0-1.3-.1-2.7-.4-3.9z"
            />
          </svg>
          {{ t('login.continueGoogle') }}
        </button>
        <p v-if="error" class="mt-4 text-sm text-amber-deep">{{ error }}</p>
      </template>
    </div>
  </main>
</template>
