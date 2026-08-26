<script setup lang="ts">
import { RouterView } from 'vue-router'
import InstallPromptSheet from '@/components/InstallPromptSheet.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'
import { useNotifications } from '@/composables/useNotifications'
import { useTheme } from '@/composables/useTheme'

useTheme()
useNotifications()
</script>

<template>
  <div class="app-root mx-auto flex min-h-dvh w-full max-w-md flex-col">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <InstallPromptSheet />
    <UpdateBanner />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
