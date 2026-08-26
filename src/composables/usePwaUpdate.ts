import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const needRefresh = ref(false)
const offlineReady = ref(false)
const updating = ref(false)

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined
let swRegistration: ServiceWorkerRegistration | undefined

function waitForUpdate(
  registration: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<boolean> {
  if (registration.waiting) {
    needRefresh.value = true
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (found: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      registration.removeEventListener('updatefound', onFound)
      resolve(found)
    }

    const timer = window.setTimeout(() => finish(needRefresh.value), timeoutMs)

    const watchInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (
          worker.state === 'installed' &&
          navigator.serviceWorker.controller &&
          registration.waiting
        ) {
          needRefresh.value = true
          finish(true)
        }
      })
    }

    const onFound = () => {
      watchInstalling(registration.installing)
    }

    registration.addEventListener('updatefound', onFound)
    watchInstalling(registration.installing)
  })
}

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
      swRegistration = registration
      const check = () => void registration.update()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, 60 * 60 * 1000)
    },
  })
}

export async function checkForUpdate(): Promise<boolean> {
  if (!swRegistration) return false
  try {
    await swRegistration.update()
  } catch {
    return needRefresh.value
  }
  return waitForUpdate(swRegistration, 1500)
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
    checkForUpdate,
  }
}
