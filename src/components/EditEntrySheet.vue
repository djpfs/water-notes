<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WaterEntry } from '@/types'

const props = defineProps<{
  open: boolean
  entry: WaterEntry | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [ml: number]
}>()

const amount = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.entry) {
      amount.value = String(props.entry.ml)
    }
  },
)

const parsedMl = computed(() => {
  const n = Number(String(amount.value ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
})

function close() {
  emit('update:open', false)
}

function submit() {
  if (parsedMl.value <= 0) return
  emit('save', parsedMl.value)
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open && entry"
        class="sheet-scrim fixed inset-0 z-50 flex items-end justify-center bg-ink/35 sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          class="safe-pb w-full max-w-md rounded-t-3xl bg-surface-raised p-5 shadow-xl ring-1 ring-line sm:rounded-3xl"
          role="dialog"
          aria-modal="true"
        >
          <h2 class="font-display text-xl font-bold text-ink">Editar lançamento</h2>
          <p class="mt-1 text-sm text-ink-soft">Quantidade em ml</p>
          <input
            v-model="amount"
            type="number"
            inputmode="decimal"
            min="1"
            class="mt-4 h-14 w-full rounded-2xl bg-mist px-4 text-center font-display text-3xl font-bold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
          />
          <div class="mt-5 flex gap-3">
            <button
              type="button"
              class="h-12 flex-1 rounded-2xl bg-mist-deep font-semibold text-ink-soft"
              @click="close"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="h-12 flex-1 rounded-2xl bg-teal font-semibold text-surface-raised disabled:opacity-40"
              :disabled="parsedMl <= 0"
              @click="submit"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-enter-active > div,
.sheet-leave-active > div {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div,
.sheet-leave-to > div {
  transform: translateY(24px);
}
</style>
