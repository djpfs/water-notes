<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WaterEntry } from '@/types'
import { formatTime, formatVolume } from '@/utils/date'

const props = defineProps<{
  entries: WaterEntry[]
}>()

defineEmits<{
  remove: [id: string]
  edit: [entry: WaterEntry]
}>()

const PREVIEW = 5
const showAll = ref(false)

const visibleEntries = computed(() =>
  showAll.value ? props.entries : props.entries.slice(0, PREVIEW),
)

const hiddenCount = computed(() =>
  Math.max(0, props.entries.length - PREVIEW),
)
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">
      Hoje
    </h2>

    <div
      v-if="entries.length === 0"
      class="mt-3 rounded-3xl bg-surface px-5 py-8 text-center ring-1 ring-line"
    >
      <div
        class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-mist-deep"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3C12 3 5 11 5 16a7 7 0 0014 0c0-5-7-13-7-13z"
            class="fill-teal"
          />
        </svg>
      </div>
      <p class="font-display text-lg font-bold text-ink">Comece com um gole</p>
      <p class="mt-1 text-sm text-ink-soft">
        Toque em um atalho de copo ou adicione um valor manual.
      </p>
    </div>

    <template v-else>
      <ul class="mt-3 space-y-2">
        <li
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="flex items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-3 ring-1 ring-line"
        >
          <button
            type="button"
            class="min-w-0 flex-1 rounded-xl px-1 text-left"
            @click="$emit('edit', entry)"
          >
            <p class="font-semibold text-ink">{{ formatVolume(entry.ml) }}</p>
            <p class="text-xs text-ink-soft">{{ formatTime(entry.at) }} · editar</p>
          </button>
          <button
            type="button"
            class="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-ink-soft transition hover:bg-mist-deep hover:text-ink"
            @click="$emit('remove', entry.id)"
          >
            Remover
          </button>
        </li>
      </ul>

      <button
        v-if="hiddenCount > 0 && !showAll"
        type="button"
        class="mt-2 h-10 w-full rounded-xl text-sm font-semibold text-teal"
        @click="showAll = true"
      >
        Ver mais ({{ hiddenCount }})
      </button>
      <button
        v-else-if="showAll && entries.length > PREVIEW"
        type="button"
        class="mt-2 h-10 w-full rounded-xl text-sm font-semibold text-ink-soft"
        @click="showAll = false"
      >
        Ver menos
      </button>
    </template>
  </section>
</template>
