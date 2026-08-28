import { i18n } from '@/i18n'
import { onMounted, onUnmounted, watch } from 'vue'
import { fetchMe } from '@/composables/useCloudSync'
import {
  subscribeRemotePush,
  unsubscribeRemotePush,
} from '@/composables/useRemotePush'
import { useAppStore } from '@/stores/app'
import type { AppLocale, NotificationSettings } from '@/types'

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
  locale: AppLocale
  nickname: string
  remainingMl: number
  goalReached: boolean
}

const PERIODIC_TAG = 'water-reminder'
const PERIODIC_MIN_MS = 12 * 60 * 60 * 1000

function buildPayload(store: ReturnType<typeof useAppStore>): ReminderPayload {
  const n = store.notifications
  const fallbackNickname = store.locale === 'en' ? 'there' : 'você'
  return {
    type: 'SET_REMINDERS',
    enabled: n.enabled,
    intervalMinutes: n.intervalMinutes,
    windowStartHour: n.windowStartHour,
    windowStartMinute: n.windowStartMinute,
    windowEndHour: n.windowEndHour,
    windowEndMinute: n.windowEndMinute,
    pauseWhenGoalReached: n.pauseWhenGoalReached,
    locale: store.locale,
    nickname: store.profile.nickname || fallbackNickname,
    remainingMl: store.remainingMl,
    goalReached: store.goalReached,
  }
}

async function postToSw(payload: object) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  reg.active?.postMessage(payload)
}

async function registerPeriodicSync(enabled: boolean) {
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
    await periodic.register(PERIODIC_TAG, { minInterval: PERIODIC_MIN_MS })
  } catch {
    /* Periodic Sync pode exigir permissão / instalado como PWA */
  }
}

async function syncRemotePush(enabled: boolean) {
  const user = await fetchMe()
  if (!user) return
  if (enabled) {
    await subscribeRemotePush().catch(() => {})
  } else {
    await unsubscribeRemotePush().catch(() => {})
  }
}

export async function syncReminders() {
  const store = useAppStore()
  const payload = buildPayload(store)
  await postToSw(payload)
  await registerPeriodicSync(store.notifications.enabled)
  await syncRemotePush(store.notifications.enabled)
  return payload
}

export async function enableNotifications() {
  if (!('Notification' in window)) {
    throw new Error(i18n.global.t('notifications.unsupported'))
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    useAppStore().setNotifications({ enabled: false })
    throw new Error(i18n.global.t('notifications.denied'))
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
    throw new Error(i18n.global.t('notifications.unsupported'))
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      throw new Error(i18n.global.t('notifications.denied'))
    }
  }
  await postToSw({ type: 'TEST_REMINDER' })
}

function onSwMessage(event: MessageEvent) {
  if (event.data?.type !== 'REQUEST_REMINDER_REFRESH') return
  const store = useAppStore()
  const payload = buildPayload(store)
  const port = event.ports?.[0]
  port?.postMessage({
    type: 'REMINDER_STATE',
    enabled: payload.enabled,
    intervalMinutes: payload.intervalMinutes,
    windowStartHour: payload.windowStartHour,
    windowStartMinute: payload.windowStartMinute,
    windowEndHour: payload.windowEndHour,
    windowEndMinute: payload.windowEndMinute,
    pauseWhenGoalReached: payload.pauseWhenGoalReached,
    locale: payload.locale,
    nickname: payload.nickname,
    remainingMl: payload.remainingMl,
    goalReached: payload.goalReached,
  })
  void postToSw(payload)
}

export function useNotifications() {
  const store = useAppStore()

  onMounted(() => {
    void syncReminders()
    document.addEventListener('visibilitychange', onVisibility)
    navigator.serviceWorker?.addEventListener('message', onSwMessage)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    navigator.serviceWorker?.removeEventListener('message', onSwMessage)
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
      store.locale,
    ],
    () => {
      void syncReminders()
    },
  )
}
