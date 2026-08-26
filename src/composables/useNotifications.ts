import { onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import type { NotificationSettings } from '@/types'

export type ReminderPayload = {
  type: 'SET_REMINDERS'
} & Pick<
  NotificationSettings,
  | 'enabled'
  | 'intervalMinutes'
  | 'windowStartHour'
  | 'windowStartMinute'
  | 'windowEndHour'
  | 'windowEndMinute'
  | 'pauseWhenGoalReached'
> & {
  nickname: string
  remainingMl: number
  goalReached: boolean
}

const PERIODIC_TAG = 'water-reminder'

async function postToSw(payload: object) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  reg.active?.postMessage(payload)
}

async function registerPeriodicSync(enabled: boolean, intervalMinutes: number) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const periodic = (
    reg as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, options: { minInterval: number }) => Promise<void>
        unregister?: (tag: string) => Promise<void>
      }
    }
  ).periodicSync

  if (!periodic) return

  try {
    if (!enabled) {
      await periodic.unregister?.(PERIODIC_TAG)
      return
    }
    // Chrome exige minInterval alto; usamos o maior entre intervalo do user e 1h
    const minInterval = Math.max(intervalMinutes, 60) * 60 * 1000
    await periodic.register(PERIODIC_TAG, { minInterval })
  } catch {
    /* Periodic Sync pode exigir permissão / instalado como PWA */
  }
}

export async function syncReminders() {
  const store = useAppStore()
  const n = store.notifications
  await postToSw({
    type: 'SET_REMINDERS',
    enabled: n.enabled,
    intervalMinutes: n.intervalMinutes,
    windowStartHour: n.windowStartHour,
    windowStartMinute: n.windowStartMinute,
    windowEndHour: n.windowEndHour,
    windowEndMinute: n.windowEndMinute,
    pauseWhenGoalReached: n.pauseWhenGoalReached,
    nickname: store.profile.nickname || 'você',
    remainingMl: store.remainingMl,
    goalReached: store.goalReached,
  } satisfies ReminderPayload)
  await registerPeriodicSync(n.enabled, n.intervalMinutes)
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

export async function updateNotificationSettings(
  partial: Partial<NotificationSettings>,
) {
  useAppStore().setNotifications(partial)
  await syncReminders()
}

export async function sendTestNotification() {
  if (!('Notification' in window)) {
    throw new Error('Este navegador não suporta notificações.')
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      throw new Error('Permissão de notificação negada.')
    }
  }
  await postToSw({ type: 'TEST_REMINDER' })
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
      store.notifications.windowStartHour,
      store.notifications.windowStartMinute,
      store.notifications.windowEndHour,
      store.notifications.windowEndMinute,
      store.notifications.pauseWhenGoalReached,
      store.remainingMl,
      store.goalReached,
      store.profile.nickname,
    ],
    () => {
      void syncReminders()
    },
  )
}
