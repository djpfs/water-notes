<script setup lang="ts">
import { computed } from 'vue'
import type { DayStat } from '@/types'
import { formatDayLabel, formatVolume } from '@/utils/date'

const props = defineProps<{
  days: DayStat[]
}>()

const maxValue = computed(() =>
  Math.max(
    1,
    ...props.days.map((d) => Math.max(d.consumedMl, d.goalMl)),
  ),
)
</script>

<template>
  <div class="rounded-3xl bg-surface p-4 ring-1 ring-line">
    <div class="flex h-40 items-end gap-1.5">
      <div
        v-for="day in days"
        :key="day.date"
        class="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
      >
        <div class="relative flex h-28 w-full items-end justify-center">
          <div
            class="absolute bottom-0 w-[55%] rounded-t-md bg-line/70"
            :style="{ height: `${(day.goalMl / maxValue) * 100}%` }"
            title="Meta"
          />
          <div
            class="relative w-[55%] rounded-t-md transition-all"
            :class="day.reached ? 'bg-teal' : 'bg-water-deep'"
            :style="{ height: `${(day.consumedMl / maxValue) * 100}%` }"
            :title="formatVolume(day.consumedMl)"
          />
        </div>
        <span class="truncate text-[10px] font-medium text-ink-soft">
          {{ formatDayLabel(day.date).replace('.', '') }}
        </span>
      </div>
    </div>
    <div class="mt-3 flex gap-4 text-xs text-ink-soft">
      <span class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-sm bg-teal" /> Consumo
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-sm bg-line" /> Meta
      </span>
    </div>
  </div>
</template>
