<script setup lang="ts">
defineProps<{
  message: string
  actionLabel?: string
}>()

defineEmits<{
  action: []
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="message"
        class="safe-pb fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4"
      >
        <div
          class="flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-surface-raised shadow-lg"
          role="status"
        >
          <p class="flex-1 text-sm font-medium">{{ message }}</p>
          <button
            v-if="actionLabel"
            type="button"
            class="shrink-0 text-sm font-bold text-amber"
            @click="$emit('action')"
          >
            {{ actionLabel }}
          </button>
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-mist"
            aria-label="Fechar"
            @click="$emit('close')"
          >
            OK
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
