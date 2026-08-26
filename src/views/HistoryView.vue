<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import HistoryChart from '@/components/HistoryChart.vue'
import { useAppStore } from '@/stores/app'
import {
  addDays,
  formatDateKey,
  formatTime,
  formatVolume,
  localDateKey,
} from '@/utils/date'
import { goBackOr } from '@/utils/navigation'

const router = useRouter()
const store = useAppStore()
const { t } = useI18n()
const range = ref<7 | 30>(7)
const selectedDate = ref(localDateKey())

const todayKey = computed(() => localDateKey())
const minDate = computed(() => addDays(todayKey.value, -89))

const days = computed(() => store.historyDays(range.value))
const reachedCount = computed(() => days.value.filter((d) => d.reached).length)
const totalConsumed = computed(() =>
  days.value.reduce((sum, d) => sum + d.consumedMl, 0),
)
const isEmpty = computed(() => store.entries.length === 0)

const selectedStat = computed(() => store.dayStat(selectedDate.value))

const selectedEntries = computed(() =>
  store.entries
    .filter((e) => localDateKey(new Date(e.at)) === selectedDate.value)
    .sort((a, b) => (a.at < b.at ? 1 : -1)),
)

watch(todayKey, (today) => {
  if (selectedDate.value > today) selectedDate.value = today
})
</script>

<template>
  <main class="safe-pb flex min-h-dvh flex-col px-5 pb-8">
    <header class="app-bar flex items-center gap-3">
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-xl bg-mist-deep text-ink"
        :aria-label="t('common.back')"
        @click="goBackOr(router, { name: 'home' })"
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
      <h1 class="font-display text-2xl font-bold text-ink">{{ t('history.title') }}</h1>
    </header>

    <section v-if="isEmpty" class="mt-8 rounded-2xl bg-surface px-5 py-10 text-center ring-1 ring-line">
      <p class="font-display text-lg font-bold text-ink">{{ t('history.emptyTitle') }}</p>
      <p class="mt-2 text-sm text-ink-soft">
        {{ t('history.emptyHint') }}
      </p>
      <button
        type="button"
        class="mt-5 h-11 rounded-2xl bg-teal px-6 text-sm font-semibold text-surface-raised"
        @click="router.push({ name: 'home' })"
      >
        {{ t('history.registerWater') }}
      </button>
    </section>

    <template v-else>
      <section class="mt-5 grid grid-cols-2 gap-3">
        <div class="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p class="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {{ t('history.streak') }}
          </p>
          <p class="mt-1 font-display text-3xl font-bold text-teal-deep tabular-nums">
            {{ store.streak }}
          </p>
          <p class="text-xs text-ink-soft">{{ t('history.streakDays') }}</p>
        </div>
        <div class="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p class="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {{ t('history.goalsInPeriod') }}
          </p>
          <p class="mt-1 font-display text-3xl font-bold text-ink tabular-nums">
            {{ reachedCount }}/{{ range }}
          </p>
          <p class="text-xs text-ink-soft">{{ t('history.total', { amount: formatVolume(totalConsumed) }) }}</p>
        </div>
      </section>

      <div class="mt-5 flex gap-2">
        <button
          type="button"
          class="h-10 flex-1 rounded-xl text-sm font-semibold"
          :class="range === 7 ? 'bg-teal text-surface-raised' : 'bg-mist-deep text-ink-soft'"
          @click="range = 7"
        >
          {{ t('history.days7') }}
        </button>
        <button
          type="button"
          class="h-10 flex-1 rounded-xl text-sm font-semibold"
          :class="range === 30 ? 'bg-teal text-surface-raised' : 'bg-mist-deep text-ink-soft'"
          @click="range = 30"
        >
          {{ t('history.days30') }}
        </button>
      </div>

      <section class="mt-4">
        <HistoryChart :days="days" :range="range" />
      </section>

      <section class="mt-6">
        <h2 class="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {{ t('history.dayDetail') }}
        </h2>
        <label class="block overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <span class="block border-b border-line px-4 py-2 text-xs text-ink-soft">
            {{ t('history.pickDate') }}
          </span>
          <input
            v-model="selectedDate"
            type="date"
            class="date-input h-12 w-full bg-transparent px-4 font-medium text-ink outline-none"
            :min="minDate"
            :max="todayKey"
          />
        </label>

        <div class="mt-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink">
                {{ formatDateKey(selectedDate) }}
              </p>
              <p class="mt-1 text-sm text-ink-soft">
                {{ formatVolume(selectedStat.consumedMl) }}
                /
                {{ formatVolume(selectedStat.goalMl) }}
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
              :class="
                selectedStat.reached
                  ? 'bg-teal/15 text-teal-deep'
                  : 'bg-mist-deep text-ink-soft'
              "
            >
              {{ selectedStat.reached ? t('history.goalOk') : t('history.goalMissed') }}
            </span>
          </div>
        </div>

        <ul v-if="selectedEntries.length" class="mt-3 space-y-2">
          <li
            v-for="entry in selectedEntries"
            :key="entry.id"
            class="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
          >
            <div>
              <p class="font-semibold text-ink">{{ formatVolume(entry.ml) }}</p>
              <p class="text-xs text-ink-soft">{{ formatTime(entry.at) }}</p>
            </div>
          </li>
        </ul>

        <p
          v-else
          class="mt-3 rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-soft ring-1 ring-line"
        >
          {{ t('history.noEntriesDay') }}
        </p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.date-input {
  color-scheme: light dark;
}

.date-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.7;
}
</style>
