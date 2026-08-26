import { onMounted, onUnmounted, watch } from 'vue'
import { fetchMe, flushCloudPush, scheduleCloudPush } from '@/composables/useCloudSync'
import { useAppStore } from '@/stores/app'

export function useSyncPush() {
  const store = useAppStore()

  watch(
    () => ({
      entries: store.entries,
      cups: store.cups,
      profile: store.profile,
      notifications: store.notifications,
      feedback: store.feedback,
      theme: store.theme,
      locale: store.locale,
      celebratedDate: store.celebratedDate,
      dailyGoalSnapshots: store.dailyGoalSnapshots,
    }),
    () => scheduleCloudPush(),
    { deep: true },
  )

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      void flushCloudPush()
      return
    }
    if (document.visibilityState === 'visible') {
      void fetchMe().then((user) => {
        if (user) scheduleCloudPush()
      })
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
  })
}
