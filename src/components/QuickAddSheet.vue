<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [ml: number]
}>()

const unit = ref<'ml' | 'L'>('ml')
const amount = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      amount.value = ''
      unit.value = 'ml'
    }
  },
)

const parsedMl = computed(() => {
  const raw = String(amount.value ?? '').trim().replace(',', '.')
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return unit.value === 'L' ? n * 1000 : n
})

const canSubmit = computed(() => parsedMl.value > 0)

function close() {
  emit('update:open', false)
}

function submit() {
  if (!canSubmit.value) return
  emit('confirm', parsedMl.value)
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
          aria-labelledby="quick-add-title"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
          <h2 id="quick-add-title" class="font-display text-xl font-bold text-ink">
            Registrar consumo
          </h2>
          <p class="mt-1 text-sm text-ink-soft">Informe a quantidade em ml ou litros.</p>

          <div class="mt-5 flex gap-2">
            <button
              type="button"
              class="h-11 flex-1 rounded-xl text-sm font-semibold transition"
              :class="
                unit === 'ml'
                  ? 'bg-teal text-surface-raised'
                  : 'bg-mist-deep text-ink-soft'
              "
              @click="unit = 'ml'"
            >
              ml
            </button>
            <button
              type="button"
              class="h-11 flex-1 rounded-xl text-sm font-semibold transition"
              :class="
                unit === 'L'
                  ? 'bg-teal text-surface-raised'
                  : 'bg-mist-deep text-ink-soft'
              "
              @click="unit = 'L'"
            >
              L
            </button>
          </div>

          <label class="mt-4 block">
            <span class="sr-only">Quantidade</span>
            <input
              v-model="amount"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              placeholder="0"
              class="h-14 w-full rounded-2xl bg-mist px-4 text-center font-display text-3xl font-bold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
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
              Adicionar
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
