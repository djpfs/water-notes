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
          class="vessel-body"
          d="M42 28h116c6 0 12 6 12 12v164c0 42-32 66-70 66s-70-24-70-66V40c0-6 6-12 12-12z"
          stroke-width="3"
        />

        <g clip-path="url(#vesselClip)">
          <g
            class="water-lift"
            :style="{ transform: `translateY(${100 - fillPercent}%)` }"
          >
            <g class="water-bob">
              <rect x="0" y="0" width="200" height="280" fill="url(#waterGrad)" />
              <g class="wave-scroll">
                <path
                  class="wave-a"
                  d="M0 8 Q25 -8 50 8 T100 8 T150 8 T200 8 T250 8 T300 8 T350 8 T400 8 V280 H0 Z"
                />
                <path
                  class="wave-b"
                  d="M0 16 Q25 2 50 16 T100 16 T150 16 T200 16 T250 16 T300 16 T350 16 T400 16 V280 H0 Z"
                />
              </g>
            </g>
          </g>
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
.vessel-body {
  fill: var(--wn-surface-raised);
  stroke: var(--wn-line);
}

.water-lift {
  transform-origin: center bottom;
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.wave-a {
  fill: oklch(0.82 0.07 200 / 0.5);
}

.wave-b {
  fill: oklch(0.88 0.05 200 / 0.35);
}

.wave-scroll {
  animation: wave-drift 4.5s linear infinite;
}

.water-bob {
  animation: water-bob 3.2s ease-in-out infinite;
  transform-origin: center top;
}

@keyframes wave-drift {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-200px);
  }
}

@keyframes water-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave-scroll,
  .water-bob {
    animation: none;
  }
}
</style>
