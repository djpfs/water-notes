<script setup lang="ts">
import { computed } from 'vue'
import type { DayStat } from '@/types'
import { formatChartDayLabel, formatVolume } from '@/utils/date'

const props = defineProps<{
  days: DayStat[]
  range: 7 | 30
}>()

const maxValue = computed(() =>
  Math.max(
    1,
    ...props.days.map((d) => Math.max(d.consumedMl, d.goalMl)),
  ),
)

const compact = computed(() => props.range > 7)
const barMinWidth = computed(() => (compact.value ? 22 : 0))
</script>

<template>
  <div class="rounded-3xl bg-surface p-4 ring-1 ring-line">
    <div
      class="chart-scroll"
      :class="compact ? 'overflow-x-auto pb-1 -mx-1 px-1' : ''"
    >
      <div
        class="flex items-end gap-1.5"
        :class="compact ? 'min-w-max' : 'h-40'"
        :style="compact ? undefined : { height: '10rem' }"
      >
        <div
          v-for="day in days"
          :key="day.date"
          class="flex shrink-0 flex-col items-center justify-end gap-1"
          :style="compact ? { width: `${barMinWidth}px` } : { flex: '1 1 0', minWidth: 0 }"
        >
          <div
            class="relative flex w-full items-end justify-center"
            :class="compact ? 'h-28' : 'h-28'"
          >
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
          <span
            class="block w-full text-center text-[10px] font-medium leading-none text-ink-soft"
            :class="compact ? 'tabular-nums' : 'truncate'"
          >
            {{ formatChartDayLabel(day.date, range) }}
          </span>
        </div>
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

<style scoped>
.chart-scroll {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.chart-scroll::-webkit-scrollbar {
  display: none;
}
</style>
