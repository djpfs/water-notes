<script setup lang="ts">
import { RouterView } from 'vue-router'
import InstallPromptSheet from '@/components/InstallPromptSheet.vue'
import UndoToast from '@/components/UndoToast.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'
import { useAutoSync } from '@/composables/useAutoSync'
import { useSyncPush } from '@/composables/useSyncPush'
import { useNotifications } from '@/composables/useNotifications'
import { useTapFeedback } from '@/composables/useTapFeedback'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'

useTheme()
useNotifications()
useTapFeedback()
useAutoSync()
useSyncPush()

const { message, actionLabel, onAction, clear } = useToast()
</script>

<template>
  <div class="app-root mx-auto flex min-h-dvh w-full max-w-md flex-col">
    <RouterView v-slot="{ Component, route }">
      <Transition name="fade">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
    <InstallPromptSheet />
    <UpdateBanner />
    <UndoToast
      :message="message"
      :action-label="actionLabel"
      @action="onAction"
      @close="clear"
    />
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
