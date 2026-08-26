<script setup lang="ts">
import { computed } from 'vue'
import { formatVolume } from '@/utils/date'

const props = defineProps<{
  progress: number
  consumedMl: number
  goalMl: number
}>()

const fillPercent = computed(() => Math.min(100, Math.max(0, props.progress * 100)))
const pctLabel = computed(() => Math.round(fillPercent.value))
</script>

<template>
  <div class="relative mx-auto flex w-full max-w-[280px] flex-col items-center">
    <div class="vessel-shell relative aspect-[3/4] w-full">
      <svg viewBox="0 0 200 280" class="h-full w-full drop-shadow-sm" aria-hidden="true">
        <defs>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="oklch(0.78 0.08 205)" />
            <stop offset="100%" stop-color="oklch(0.52 0.1 210)" />
          </linearGradient>
          <clipPath id="vesselClip">
            <path
              d="M50 36h100c4 0 8 4 8 8v160c0 36-26 56-58 56s-58-20-58-56V44c0-4 4-8 8-8z"
            />
          </clipPath>
        </defs>

        <path
          d="M42 28h116c6 0 12 6 12 12v164c0 42-32 66-70 66s-70-24-70-66V40c0-6 6-12 12-12z"
          fill="oklch(0.97 0.01 210)"
          stroke="oklch(0.78 0.03 210)"
          stroke-width="3"
        />

        <g clip-path="url(#vesselClip)">
          <rect
            class="water-fill"
            x="0"
            y="0"
            width="200"
            height="280"
            fill="url(#waterGrad)"
            :style="{ transform: `translateY(${100 - fillPercent}%)` }"
          />
          <path
            class="wave"
            :d="`M0 ${236 - (fillPercent / 100) * 200} Q50 ${220 - (fillPercent / 100) * 200} 100 ${236 - (fillPercent / 100) * 200} T200 ${236 - (fillPercent / 100) * 200} V280 H0 Z`"
            fill="oklch(0.82 0.07 200 / 0.45)"
          />
        </g>

        <path
          d="M50 36h100c4 0 8 4 8 8v160c0 36-26 56-58 56s-58-20-58-56V44c0-4 4-8 8-8z"
          fill="none"
          stroke="oklch(0.55 0.06 200 / 0.35)"
          stroke-width="2"
        />
      </svg>

      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p class="font-display text-5xl font-bold tracking-tight text-ink tabular-nums">
          {{ pctLabel }}%
        </p>
        <p class="mt-1 text-sm font-medium text-ink-soft">
          {{ formatVolume(consumedMl) }}
          <span class="text-ink-soft/70">/</span>
          {{ formatVolume(goalMl) }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.water-fill {
  transform-origin: center bottom;
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.wave {
  transition: d 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .water-fill,
  .wave {
    transition: none;
  }
}
</style>
