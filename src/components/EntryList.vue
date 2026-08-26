<script setup lang="ts">
import type { WaterEntry } from '@/types'
import { formatTime, formatVolume } from '@/utils/date'

defineProps<{
  entries: WaterEntry[]
}>()

defineEmits<{
  remove: [id: string]
}>()
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">
      Hoje
    </h2>

    <p v-if="entries.length === 0" class="mt-3 text-sm text-ink-soft">
      Nenhum registro ainda. Toque em um copo ou adicione manualmente.
    </p>

    <ul v-else class="mt-3 space-y-2">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
      >
        <div>
          <p class="font-semibold text-ink">{{ formatVolume(entry.ml) }}</p>
          <p class="text-xs text-ink-soft">{{ formatTime(entry.at) }}</p>
        </div>
        <button
          type="button"
          class="h-10 rounded-xl px-3 text-sm font-medium text-ink-soft transition hover:bg-mist-deep hover:text-ink"
          @click="$emit('remove', entry.id)"
        >
          Remover
        </button>
      </li>
    </ul>
  </section>
</template>
