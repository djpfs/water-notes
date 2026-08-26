<script setup lang="ts">
import ProfileAvatar from '@/components/ProfileAvatar.vue'
import { useAppStore } from '@/stores/app'
import { formatVolume } from '@/utils/date'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  settings: []
}>()

const store = useAppStore()

function close() {
  emit('update:open', false)
}

function openSettings() {
  emit('settings')
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[65] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-5"
        data-haptic="off"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        @click.self="close"
      >
        <div
          class="safe-pb w-full max-w-md rounded-t-3xl bg-surface-raised p-6 shadow-xl ring-1 ring-line sm:rounded-3xl"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />

          <div class="flex flex-col items-center text-center">
            <ProfileAvatar
              :avatar-id="store.profile.avatarId"
              :use-profile-photo="store.profile.useProfilePhoto"
              :photo-url="store.profile.photoUrl"
              :size="88"
            />
            <h2
              id="profile-modal-title"
              class="mt-4 font-display text-2xl font-bold text-ink"
            >
              {{ store.profile.nickname }}
            </h2>
            <p v-if="store.profile.email" class="mt-1 text-sm text-ink-soft">
              {{ store.profile.email }}
            </p>
          </div>

          <dl class="mt-6 space-y-0 overflow-hidden rounded-2xl bg-mist/60 ring-1 ring-line">
            <div class="flex items-center justify-between border-b border-line px-4 py-3">
              <dt class="text-sm text-ink-soft">Peso</dt>
              <dd class="text-sm font-semibold text-ink tabular-nums">
                {{ store.profile.weightKg }} kg
              </dd>
            </div>
            <div class="flex items-center justify-between border-b border-line px-4 py-3">
              <dt class="text-sm text-ink-soft">Meta diária</dt>
              <dd class="text-sm font-semibold text-ink tabular-nums">
                {{ formatVolume(store.dailyGoalMl) }}
              </dd>
            </div>
            <div class="flex items-center justify-between border-b border-line px-4 py-3">
              <dt class="text-sm text-ink-soft">Hoje</dt>
              <dd class="text-sm font-semibold text-ink tabular-nums">
                {{ formatVolume(store.todayConsumedMl) }}
                <span class="font-normal text-ink-soft">
                  ({{ Math.round(store.progress * 100) }}%)
                </span>
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-sm text-ink-soft">Sequência</dt>
              <dd class="text-sm font-semibold text-teal-deep tabular-nums">
                {{ store.streak }} dia{{ store.streak === 1 ? '' : 's' }}
              </dd>
            </div>
          </dl>

          <div class="mt-5 flex gap-3">
            <button
              type="button"
              class="h-12 flex-1 rounded-2xl bg-mist-deep font-semibold text-ink-soft"
              @click="close"
            >
              Fechar
            </button>
            <button
              type="button"
              class="h-12 flex-1 rounded-2xl bg-teal font-semibold text-surface-raised"
              @click="openSettings"
            >
              Ajustes
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
