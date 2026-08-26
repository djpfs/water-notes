import { onMounted, onUnmounted } from 'vue'
import { fetchMe, pullAndMerge } from '@/composables/useCloudSync'

const SYNC_INTERVAL_MS = 15 * 60 * 1000

export function useAutoSync() {
  let interval: ReturnType<typeof setInterval> | undefined
  let syncing = false

  async function sync() {
    if (syncing) return
    syncing = true
    try {
      const user = await fetchMe()
      if (user) await pullAndMerge()
    } catch {
      /* offline or session expired */
    } finally {
      syncing = false
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') void sync()
  }

  onMounted(() => {
    void sync()
    document.addEventListener('visibilitychange', onVisibility)
    interval = setInterval(() => void sync(), SYNC_INTERVAL_MS)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    if (interval) clearInterval(interval)
  })
}
