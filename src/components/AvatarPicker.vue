<script setup lang="ts">
import { AVATARS } from '@/types'
import AvatarIcon from './AvatarIcon.vue'

defineProps<{
  modelValue: string
  usePhoto: boolean
  photoUrl?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:usePhoto': [value: boolean]
}>()

function pickPhoto() {
  emit('update:usePhoto', true)
}

function pickAvatar(id: string) {
  emit('update:usePhoto', false)
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="grid grid-cols-4 gap-3">
    <button
      v-if="photoUrl"
      type="button"
      class="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-transform duration-200 ease-out active:scale-95"
      :class="
        usePhoto
          ? 'bg-teal/15 ring-2 ring-teal'
          : 'bg-surface/70 ring-1 ring-line hover:bg-surface'
      "
      :aria-pressed="usePhoto"
      aria-label="Sua foto"
      @click="pickPhoto"
    >
      <img
        :src="photoUrl"
        alt=""
        class="size-[52px] rounded-full object-cover ring-1 ring-line"
        referrerpolicy="no-referrer"
      />
      <span class="text-[11px] font-medium text-ink-soft">Sua foto</span>
    </button>

    <button
      v-for="avatar in AVATARS"
      :key="avatar.id"
      type="button"
      class="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-transform duration-200 ease-out active:scale-95"
      :class="
        !usePhoto && modelValue === avatar.id
          ? 'bg-teal/15 ring-2 ring-teal'
          : 'bg-surface/70 ring-1 ring-line hover:bg-surface'
      "
      :aria-pressed="!usePhoto && modelValue === avatar.id"
      :aria-label="avatar.label"
      @click="pickAvatar(avatar.id)"
    >
      <AvatarIcon :id="avatar.id" :size="52" />
      <span class="text-[11px] font-medium text-ink-soft">{{ avatar.label }}</span>
    </button>
  </div>
</template>
