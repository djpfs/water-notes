import { onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'

export type ReminderPayload = {
  type: 'SET_REMINDERS'
  enabled: boolean
  intervalMinutes: number
  nickname: string
  remainingMl: number
  goalReached: boolean
}

async function postToSw(payload: ReminderPayload) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  reg.active?.postMessage(payload)
}

export async function syncReminders() {
  const store = useAppStore()
  await postToSw({
    type: 'SET_REMINDERS',
    enabled: store.notifications.enabled,
    intervalMinutes: store.notifications.intervalMinutes,
    nickname: store.profile.nickname || 'você',
    remainingMl: store.remainingMl,
    goalReached: store.goalReached,
  })
}

export async function enableNotifications() {
  if (!('Notification' in window)) {
    throw new Error('Este navegador não suporta notificações.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    useAppStore().setNotifications({ enabled: false })
    throw new Error('Permissão de notificação negada.')
  }
  useAppStore().setNotifications({ enabled: true })
  await syncReminders()
}

export async function disableNotifications() {
  useAppStore().setNotifications({ enabled: false })
  await syncReminders()
}

export async function setNotificationInterval(minutes: number) {
  useAppStore().setNotifications({ intervalMinutes: minutes })
  await syncReminders()
}

export function useNotifications() {
  const store = useAppStore()

  onMounted(() => {
    void syncReminders()
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
  })

  function onVisibility() {
    if (document.visibilityState === 'visible') void syncReminders()
  }

  watch(
    () => [
      store.notifications.enabled,
      store.notifications.intervalMinutes,
      store.remainingMl,
      store.goalReached,
      store.profile.nickname,
    ],
    () => {
      void syncReminders()
    },
  )
}
