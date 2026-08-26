<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarIcon from '@/components/AvatarIcon.vue'
import CupShortcutBar from '@/components/CupShortcutBar.vue'
import EntryList from '@/components/EntryList.vue'
import GoalCelebration from '@/components/GoalCelebration.vue'
import QuickAddSheet from '@/components/QuickAddSheet.vue'
import WaterVessel from '@/components/WaterVessel.vue'
import { useAppStore } from '@/stores/app'
import type { Cup } from '@/types'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()

const sheetOpen = ref(false)
const celebrateOpen = ref(false)

watch(
  () => store.todayConsumedMl,
  async () => {
    await nextTick()
    if (store.shouldCelebrate()) {
      celebrateOpen.value = true
      store.markCelebratedToday()
    }
  },
)

function onCup(cup: Cup) {
  store.addEntry(cup.ml)
}

function onManual(ml: number) {
  store.addEntry(ml)
}

function onCelebrateDone() {
  celebrateOpen.value = false
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5 pb-6">
    <header class="flex items-center justify-between pt-1">
      <div class="flex items-center gap-3">
        <AvatarIcon :id="store.profile.avatarId" :size="44" />
        <div>
          <p class="text-xs font-medium text-ink-soft">Olá,</p>
          <p class="font-display text-lg font-bold leading-tight text-ink">
            {{ store.profile.nickname }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="h-11 rounded-xl px-3 text-sm font-semibold text-teal"
        @click="router.push({ name: 'settings' })"
      >
        Ajustes
      </button>
    </header>

    <section class="mt-4">
      <WaterVessel
        :progress="store.progress"
        :consumed-ml="store.todayConsumedMl"
        :goal-ml="store.dailyGoalMl"
      />
      <p class="mt-3 text-center text-sm text-ink-soft">
        <template v-if="store.goalReached">
          Meta atingida — pode continuar registrando.
        </template>
        <template v-else>
          Faltam <span class="font-semibold text-ink">{{ formatVolume(store.remainingMl) }}</span>
        </template>
      </p>
    </section>

    <section class="mt-6">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Atalhos
        </h2>
        <button
          type="button"
          class="text-sm font-semibold text-teal"
          @click="sheetOpen = true"
        >
          Outro valor
        </button>
      </div>
      <CupShortcutBar :cups="store.cups" @select="onCup" />
    </section>

    <div class="mt-6 flex-1">
      <EntryList :entries="store.todayEntries" @remove="store.removeEntry" />
    </div>

    <QuickAddSheet v-model:open="sheetOpen" @confirm="onManual" />
    <GoalCelebration
      v-model:open="celebrateOpen"
      :nickname="store.profile.nickname"
      @done="onCelebrateDone"
    />
  </main>
</template>
