<script setup lang="ts">
import type { Cup } from '@/types'
import { formatVolume } from '@/utils/date'

defineProps<{
  cups: Cup[]
}>()

defineEmits<{
  select: [cup: Cup]
}>()
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <button
      v-for="cup in cups"
      :key="cup.id"
      type="button"
      class="flex min-w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-2xl bg-surface px-3 py-3 ring-1 ring-line transition duration-200 ease-out hover:bg-surface-raised active:scale-95"
      @click="$emit('select', cup)"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3C12 3 6 10 6 15a6 6 0 0012 0c0-5-6-12-6-12z"
          class="fill-teal"
        />
      </svg>
      <span class="text-xs font-semibold text-ink">{{ cup.label }}</span>
      <span class="text-[11px] text-ink-soft">{{ formatVolume(cup.ml) }}</span>
    </button>
  </div>
</template>
