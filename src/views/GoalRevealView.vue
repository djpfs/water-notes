<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ProfileAvatar from '@/components/ProfileAvatar.vue'
import { useAppStore } from '@/stores/app'
import { ML_PER_KG } from '@/types'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()
const { t } = useI18n()

function start() {
  router.replace({ name: 'home' })
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5">
    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <ProfileAvatar
        :avatar-id="store.profile.avatarId"
        :use-profile-photo="store.profile.useProfilePhoto"
        :photo-url="store.profile.photoUrl"
        :size="88"
      />
      <p class="mt-5 text-sm font-medium text-teal">
        {{ t('goalReveal.helloName', { name: store.profile.nickname }) }}
      </p>
      <h1 class="mt-2 font-display text-3xl font-bold text-ink">
        {{ t('goalReveal.title') }}
      </h1>
      <p class="mt-6 font-display text-5xl font-bold tracking-tight text-teal-deep tabular-nums">
        {{ formatVolume(store.dailyGoalMl) }}
      </p>
      <p class="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
        {{ t('goalReveal.subtitle', { weight: store.profile.weightKg, ratio: ML_PER_KG }) }}
        {{ t('goalReveal.description') }}
      </p>
    </div>

    <button
      type="button"
      class="h-13 min-h-12 w-full rounded-2xl bg-teal font-semibold text-surface-raised"
      @click="start"
    >
      {{ t('goalReveal.start') }}
    </button>
  </main>
</template>
