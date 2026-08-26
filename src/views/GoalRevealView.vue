<script setup lang="ts">
import { useRouter } from 'vue-router'
import AvatarIcon from '@/components/AvatarIcon.vue'
import { useAppStore } from '@/stores/app'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()

function start() {
  router.replace({ name: 'home' })
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5">
    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <AvatarIcon :id="store.profile.avatarId" :size="88" />
      <p class="mt-5 text-sm font-medium text-teal">
        Olá, {{ store.profile.nickname }}
      </p>
      <h1 class="mt-2 font-display text-3xl font-bold text-ink">
        Sua meta de hoje
      </h1>
      <p class="mt-6 font-display text-5xl font-bold tracking-tight text-teal-deep tabular-nums">
        {{ formatVolume(store.dailyGoalMl) }}
      </p>
      <p class="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
        Com base em {{ store.profile.weightKg }} kg × 35 ml.
        Vamos registrar o que você beber ao longo do dia.
      </p>
    </div>

    <button
      type="button"
      class="h-13 min-h-12 w-full rounded-2xl bg-teal font-semibold text-surface-raised"
      @click="start"
    >
      Começar
    </button>
  </main>
</template>
