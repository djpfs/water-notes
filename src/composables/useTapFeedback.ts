import { onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  bindTapFeedback,
  initFeedbackEnvironment,
  setFeedbackPreferences,
} from '@/utils/feedback'

export function useTapFeedback() {
  const store = useAppStore()
  let unbind: (() => void) | undefined

  onMounted(() => {
    initFeedbackEnvironment()
    setFeedbackPreferences(store.feedback)
    unbind = bindTapFeedback()
  })

  onUnmounted(() => {
    unbind?.()
  })

  watch(
    () => store.feedback,
    (prefs) => setFeedbackPreferences(prefs),
    { deep: true },
  )
}
