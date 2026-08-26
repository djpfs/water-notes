<script setup lang="ts">
import type { DayStat } from '@/types'
import { formatVolume } from '@/utils/date'
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  summaries: DayStat[]
  streak: number
}>()

defineEmits<{
  'update:open': [value: boolean]
  continue: []
}>()

const title = computed(() =>
  props.summaries.length > 1 ? 'Resumo dos dias ausentes' : 'Resumo de ontem',
)

const subtitle = computed(() =>
  props.summaries.length > 1
    ? `${props.summaries.length} dias sem abrir o app`
    : null,
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && summaries.length"
        class="fixed inset-0 z-[65] flex items-center justify-center bg-ink/50 px-5"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-sm rounded-3xl bg-surface-raised p-6 shadow-xl ring-1 ring-line">
          <p class="text-xs font-semibold uppercase tracking-wide text-teal">
            Novo dia
          </p>
          <h2 class="mt-2 font-display text-2xl font-bold text-ink">
            {{ title }}
          </h2>
          <p v-if="subtitle" class="mt-1 text-sm text-ink-soft">
            {{ subtitle }}
          </p>

          <div
            v-if="summaries.length === 1"
            class="mt-4"
          >
            <p class="font-display text-4xl font-bold text-teal-deep tabular-nums">
              {{ formatVolume(summaries[0].consumedMl) }}
            </p>
            <p class="mt-1 text-sm text-ink-soft">
              Meta era {{ formatVolume(summaries[0].goalMl) }}
              ·
              <span :class="summaries[0].reached ? 'text-teal' : 'text-ink-soft'">
                {{ summaries[0].reached ? 'meta batida' : 'meta não atingida' }}
              </span>
            </p>
          </div>

          <ul
            v-else
            class="mt-4 max-h-52 space-y-2 overflow-y-auto"
          >
            <li
              v-for="day in summaries"
              :key="day.date"
              class="flex items-center justify-between rounded-xl bg-mist-deep px-3 py-2"
            >
              <div>
                <p class="text-sm font-semibold text-ink">{{ day.date }}</p>
                <p class="text-xs text-ink-soft">
                  {{ formatVolume(day.consumedMl) }} / {{ formatVolume(day.goalMl) }}
                </p>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="day.reached ? 'bg-teal/15 text-teal-deep' : 'bg-surface text-ink-soft'"
              >
                {{ day.reached ? 'OK' : '—' }}
              </span>
            </li>
          </ul>

          <p v-if="streak > 0" class="mt-3 text-sm font-medium text-ink">
            Sequência atual: {{ streak }} dia{{ streak === 1 ? '' : 's' }}
          </p>
          <button
            type="button"
            class="mt-6 h-12 w-full rounded-2xl bg-teal font-semibold text-surface-raised"
            @click="$emit('continue')"
          >
            Começar hoje
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
