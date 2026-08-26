<script setup lang="ts">
defineProps<{
  id: string
  size?: number
}>()
</script>

<template>
  <svg
    :width="size ?? 64"
    :height="size ?? 64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="32" cy="32" r="32" class="fill-mist-deep" />

    <g v-if="id === 'drop'">
      <path
        d="M32 14c0 0-12 14-12 24a12 12 0 0024 0c0-10-12-24-12-24z"
        class="fill-teal"
      />
      <ellipse cx="28" cy="34" rx="3" ry="5" class="fill-water" opacity="0.7" />
    </g>

    <g v-else-if="id === 'wave'">
      <path
        d="M12 36c4-6 8-6 12 0s8 6 12 0 8-6 12 0 4 6 4 6H12s0-1 0-6z"
        class="fill-teal"
      />
      <path
        d="M12 44c4-5 8-5 12 0s8 5 12 0 8-5 12 0 4 5 4 5H12s0-1 0-5z"
        class="fill-water"
        opacity="0.85"
      />
    </g>

    <g v-else-if="id === 'bottle'">
      <rect x="26" y="12" width="12" height="6" rx="1" class="fill-teal-deep" />
      <path
        d="M24 20h16l3 28a6 6 0 01-6 6H27a6 6 0 01-6-6l3-28z"
        class="fill-teal"
      />
      <path d="M24 36h22l1 8H23l1-8z" class="fill-water" opacity="0.6" />
    </g>

    <g v-else-if="id === 'leaf'">
      <path
        d="M46 18c-14 2-24 14-26 28 10-4 22-6 28-18-2 0-2-8-2-10z"
        class="fill-teal"
      />
      <path
        d="M22 44c8-10 18-16 26-18"
        stroke="oklch(0.9 0.03 238)"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
      />
    </g>

    <g v-else-if="id === 'sun'">
      <circle cx="32" cy="32" r="10" class="fill-amber" />
      <g class="stroke-amber-deep" stroke-width="3" stroke-linecap="round">
        <line x1="32" y1="14" x2="32" y2="10" />
        <line x1="32" y1="54" x2="32" y2="50" />
        <line x1="14" y1="32" x2="10" y2="32" />
        <line x1="54" y1="32" x2="50" y2="32" />
        <line x1="19" y1="19" x2="16" y2="16" />
        <line x1="48" y1="48" x2="45" y2="45" />
        <line x1="45" y1="19" x2="48" y2="16" />
        <line x1="16" y1="48" x2="19" y2="45" />
      </g>
    </g>

    <g v-else-if="id === 'fish'">
      <ellipse cx="30" cy="32" rx="14" ry="9" class="fill-teal" />
      <path d="M44 32l10-8v16l-10-8z" class="fill-teal-deep" />
      <circle cx="24" cy="30" r="2" class="fill-ink" />
      <path
        d="M18 32h8"
        stroke="oklch(0.9 0.03 238)"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </g>

    <g v-else-if="id === 'cloud'">
      <ellipse cx="28" cy="34" rx="14" ry="10" class="fill-teal" />
      <ellipse cx="40" cy="32" rx="12" ry="9" class="fill-water" />
      <ellipse cx="22" cy="30" rx="8" ry="7" class="fill-teal-bright" />
    </g>

    <g v-else>
      <path
        d="M20 36c0-10 8-18 12-22 4 4 12 12 12 22a12 12 0 11-24 0z"
        class="fill-teal"
      />
      <path
        d="M26 38c2 4 6 6 10 4"
        stroke="oklch(0.9 0.03 238)"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
      />
    </g>
  </svg>
</template>
