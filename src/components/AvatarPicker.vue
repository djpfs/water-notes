<script setup lang="ts">
import { AVATARS } from '@/types'
import AvatarIcon from './AvatarIcon.vue'

defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="grid grid-cols-4 gap-3">
    <button
      v-for="avatar in AVATARS"
      :key="avatar.id"
      type="button"
      class="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-transform duration-200 ease-out active:scale-95"
      :class="
        modelValue === avatar.id
          ? 'bg-teal/15 ring-2 ring-teal'
          : 'bg-surface/70 ring-1 ring-line hover:bg-surface'
      "
      :aria-pressed="modelValue === avatar.id"
      :aria-label="avatar.label"
      @click="$emit('update:modelValue', avatar.id)"
    >
      <AvatarIcon :id="avatar.id" :size="52" />
      <span class="text-[11px] font-medium text-ink-soft">{{ avatar.label }}</span>
    </button>
  </div>
</template>
