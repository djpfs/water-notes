<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import HistoryChart from '@/components/HistoryChart.vue'
import { useAppStore } from '@/stores/app'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()
const range = ref<7 | 30>(7)

const days = computed(() => store.historyDays(range.value))
const reachedCount = computed(() => days.value.filter((d) => d.reached).length)
const totalConsumed = computed(() =>
  days.value.reduce((sum, d) => sum + d.consumedMl, 0),
)
</script>

<template>
  <main class="safe-pb flex min-h-dvh flex-col px-5 pb-8">
    <header class="app-bar flex items-center gap-3">
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-xl bg-mist-deep text-ink"
        aria-label="Voltar"
        @click="router.back()"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <h1 class="font-display text-2xl font-bold text-ink">Histórico</h1>
    </header>

    <section class="mt-5 grid grid-cols-2 gap-3">
      <div class="rounded-2xl bg-surface p-4 ring-1 ring-line">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Sequência
        </p>
        <p class="mt-1 font-display text-3xl font-bold text-teal-deep tabular-nums">
          {{ store.streak }}
        </p>
        <p class="text-xs text-ink-soft">dias seguidos</p>
      </div>
      <div class="rounded-2xl bg-surface p-4 ring-1 ring-line">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Metas no período
        </p>
        <p class="mt-1 font-display text-3xl font-bold text-ink tabular-nums">
          {{ reachedCount }}/{{ range }}
        </p>
        <p class="text-xs text-ink-soft">{{ formatVolume(totalConsumed) }} no total</p>
      </div>
    </section>

    <div class="mt-5 flex gap-2">
      <button
        type="button"
        class="h-10 flex-1 rounded-xl text-sm font-semibold"
        :class="range === 7 ? 'bg-teal text-surface-raised' : 'bg-mist-deep text-ink-soft'"
        @click="range = 7"
      >
        7 dias
      </button>
      <button
        type="button"
        class="h-10 flex-1 rounded-xl text-sm font-semibold"
        :class="range === 30 ? 'bg-teal text-surface-raised' : 'bg-mist-deep text-ink-soft'"
        @click="range = 30"
      >
        30 dias
      </button>
    </div>

    <section class="mt-4">
      <HistoryChart :days="days" :range="range" />
    </section>

    <ul class="mt-5 space-y-2">
      <li
        v-for="day in [...days].reverse()"
        :key="day.date"
        class="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
      >
        <div>
          <p class="text-sm font-semibold text-ink">{{ day.date }}</p>
          <p class="text-xs text-ink-soft">
            {{ formatVolume(day.consumedMl) }} / {{ formatVolume(day.goalMl) }}
          </p>
        </div>
        <span
          class="rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="
            day.reached
              ? 'bg-teal/15 text-teal-deep'
              : 'bg-mist-deep text-ink-soft'
          "
        >
          {{ day.reached ? 'OK' : '—' }}
        </span>
      </li>
    </ul>
  </main>
</template>
