<script setup lang="ts">
import { computed } from 'vue'
import AvatarIcon from './AvatarIcon.vue'

const props = defineProps<{
  avatarId: string
  useProfilePhoto?: boolean
  photoUrl?: string | null
  size?: number
}>()

const showPhoto = computed(
  () => props.useProfilePhoto && Boolean(props.photoUrl),
)
</script>

<template>
  <img
    v-if="showPhoto"
    :src="photoUrl!"
    alt=""
    class="shrink-0 rounded-full object-cover ring-1 ring-line"
    :style="{ width: `${size ?? 44}px`, height: `${size ?? 44}px` }"
    referrerpolicy="no-referrer"
  />
  <AvatarIcon v-else :id="avatarId" :size="size ?? 44" />
</template>
