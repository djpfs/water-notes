<script setup lang="ts">
import { usePwaUpdate } from '@/composables/usePwaUpdate'
import { APP_VERSION } from '@/version'

const { needRefresh, updating, applyUpdate, dismiss } = usePwaUpdate()
</script>

<template>
  <Teleport to="body">
    <Transition name="update">
      <div
        v-if="needRefresh"
        class="safe-pb fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-4"
      >
        <div
          class="flex w-full max-w-md items-center gap-3 rounded-2xl bg-teal-deep px-4 py-3 text-surface-raised shadow-lg ring-1 ring-teal/40"
          role="status"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold">Nova versão disponível</p>
            <p class="text-xs text-mist">
              v{{ APP_VERSION }} pronta para instalar
            </p>
          </div>
          <button
            type="button"
            class="h-10 shrink-0 rounded-xl bg-surface-raised px-3 text-sm font-semibold text-teal-deep disabled:opacity-60"
            :disabled="updating"
            @click="applyUpdate"
          >
            {{ updating ? '…' : 'Atualizar' }}
          </button>
          <button
            type="button"
            class="h-10 shrink-0 rounded-xl px-2 text-sm font-medium text-mist"
            :disabled="updating"
            @click="dismiss"
          >
            Depois
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-enter-active,
.update-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.update-enter-from,
.update-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
