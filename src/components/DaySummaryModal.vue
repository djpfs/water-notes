<script setup lang="ts">
import type { DayStat } from '@/types'
import { formatVolume } from '@/utils/date'

defineProps<{
  open: boolean
  summary: DayStat | null
  streak: number
}>()

defineEmits<{
  'update:open': [value: boolean]
  continue: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && summary"
        class="fixed inset-0 z-[65] flex items-center justify-center bg-ink/50 px-5"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-sm rounded-3xl bg-surface-raised p-6 shadow-xl ring-1 ring-line">
          <p class="text-xs font-semibold uppercase tracking-wide text-teal">
            Novo dia
          </p>
          <h2 class="mt-2 font-display text-2xl font-bold text-ink">
            Resumo de ontem
          </h2>
          <p class="mt-4 font-display text-4xl font-bold text-teal-deep tabular-nums">
            {{ formatVolume(summary.consumedMl) }}
          </p>
          <p class="mt-1 text-sm text-ink-soft">
            Meta era {{ formatVolume(summary.goalMl) }}
            ·
            <span :class="summary.reached ? 'text-teal' : 'text-ink-soft'">
              {{ summary.reached ? 'meta batida' : 'meta não atingida' }}
            </span>
          </p>
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
