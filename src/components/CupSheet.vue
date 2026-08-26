<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit'
  initialLabel?: string
  initialMl?: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [label: string, ml: number]
}>()

const label = ref('')
const ml = ref('250')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    label.value = props.mode === 'edit' ? (props.initialLabel ?? '') : ''
    ml.value = String(props.mode === 'edit' ? (props.initialMl ?? 250) : 250)
  },
)

const mlNumber = computed(() => {
  const n = Number(String(ml.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const canSubmit = computed(() => mlNumber.value > 0)

const title = computed(() =>
  props.mode === 'edit' ? 'Editar copo' : 'Novo copo',
)

function close() {
  emit('update:open', false)
}

function submit() {
  if (!canSubmit.value) return
  emit('save', label.value.trim() || 'Copo', mlNumber.value)
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          class="safe-pb w-full max-w-md rounded-t-3xl bg-surface-raised p-5 shadow-xl ring-1 ring-line sm:rounded-3xl"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="mode === 'edit' ? 'cup-edit-title' : 'cup-add-title'"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
          <h2
            :id="mode === 'edit' ? 'cup-edit-title' : 'cup-add-title'"
            class="font-display text-xl font-bold text-ink"
          >
            {{ title }}
          </h2>

          <label class="mt-5 block">
            <span class="mb-1.5 block text-sm text-ink-soft">Nome</span>
            <input
              v-model="label"
              type="text"
              placeholder="Ex.: Squeeze"
              class="h-12 w-full rounded-2xl bg-mist px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
            />
          </label>

          <label class="mt-3 block">
            <span class="mb-1.5 block text-sm text-ink-soft">Volume (ml)</span>
            <input
              v-model="ml"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              class="h-12 w-full rounded-2xl bg-mist px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
            />
          </label>

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
              :disabled="!canSubmit"
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
