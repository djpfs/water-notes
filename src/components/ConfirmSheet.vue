<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

function close() {
  emit('update:open', false)
}

function onConfirm() {
  emit('confirm')
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
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
          <h2 id="confirm-title" class="font-display text-xl font-bold text-ink">
            {{ title }}
          </h2>
          <p class="mt-2 text-sm text-ink-soft">{{ message }}</p>

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
              class="h-12 flex-1 rounded-2xl bg-amber-deep font-semibold text-surface-raised"
              @click="onConfirm"
            >
              {{ confirmLabel ?? 'Confirmar' }}
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
