import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const needRefresh = ref(false)
const offlineReady = ref(false)
const updating = ref(false)

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined

export function initPwaUpdate() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
    },
    onOfflineReady() {
      offlineReady.value = true
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Checa atualização ao focar o app / periodicamente
      const check = () => void registration.update()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, 60 * 60 * 1000)
    },
  })
}

export function usePwaUpdate() {
  async function applyUpdate() {
    if (!updateSW || updating.value) return
    updating.value = true
    try {
      await updateSW(true)
    } finally {
      updating.value = false
    }
  }

  function dismiss() {
    needRefresh.value = false
  }

  return {
    needRefresh,
    offlineReady,
    updating,
    applyUpdate,
    dismiss,
  }
}
