/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

type ReminderConfig = {
  enabled: boolean
  intervalMinutes: number
  nickname: string
  remainingMl: number
  goalReached: boolean
  windowStartHour: number
  windowStartMinute: number
  windowEndHour: number
  windowEndMinute: number
  pauseWhenGoalReached: boolean
}

let config: ReminderConfig = {
  enabled: false,
  intervalMinutes: 60,
  nickname: 'você',
  remainingMl: 0,
  goalReached: false,
  windowStartHour: 8,
  windowStartMinute: 0,
  windowEndHour: 22,
  windowEndMinute: 0,
  pauseWhenGoalReached: true,
}

let timer: ReturnType<typeof setTimeout> | undefined

const PERIODIC_TAG = 'water-reminder'

function minutesOfDay(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

function isWithinWindow(now = new Date()): boolean {
  const nowM = minutesOfDay(now)
  const start = config.windowStartHour * 60 + config.windowStartMinute
  const end = config.windowEndHour * 60 + config.windowEndMinute
  if (start === end) return true
  if (start < end) return nowM >= start && nowM < end
  return nowM >= start || nowM < end
}

function clearTimer() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

function shouldNotify(): boolean {
  if (!config.enabled) return false
  if (config.pauseWhenGoalReached && config.goalReached) return false
  if (!isWithinWindow()) return false
  return true
}

async function showReminder() {
  if (!shouldNotify()) return

  const remaining =
    config.remainingMl > 0
      ? `Faltam ${config.remainingMl} ml para a meta.`
      : 'Que tal registrar um gole?'

  await self.registration.showNotification('Hora de beber água', {
    body: `${config.nickname}, ${remaining}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'water-reminder',
    renotify: true,
    data: { url: '/inicio' },
  })
}

function msUntilNextTick(): number {
  const intervalMs = Math.max(1, config.intervalMinutes) * 60 * 1000
  if (isWithinWindow()) return intervalMs

  const now = new Date()
  const start = new Date(now)
  start.setHours(config.windowStartHour, config.windowStartMinute, 0, 0)
  if (start.getTime() <= now.getTime()) {
    start.setDate(start.getDate() + 1)
  }
  return Math.max(60_000, start.getTime() - now.getTime())
}

function scheduleNext() {
  clearTimer()
  if (!config.enabled) return
  timer = setTimeout(async () => {
    await showReminder()
    scheduleNext()
  }, msUntilNextTick())
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } & Partial<ReminderConfig>

  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }

  if (data?.type === 'TEST_REMINDER') {
    event.waitUntil(
      self.registration.showNotification('Teste Water Notes', {
        body: 'Se você viu isso, as notificações estão ok.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'water-reminder-test',
        data: { url: '/ajustes' },
      }),
    )
    return
  }

  if (data?.type !== 'SET_REMINDERS') return

  config = {
    enabled: Boolean(data.enabled),
    intervalMinutes: Number(data.intervalMinutes) || 60,
    nickname: data.nickname || 'você',
    remainingMl: Number(data.remainingMl) || 0,
    goalReached: Boolean(data.goalReached),
    windowStartHour: Number(data.windowStartHour) || 8,
    windowStartMinute: Number(data.windowStartMinute) || 0,
    windowEndHour: Number(data.windowEndHour) || 22,
    windowEndMinute: Number(data.windowEndMinute) || 0,
    pauseWhenGoalReached: data.pauseWhenGoalReached !== false,
  }

  if (config.enabled) {
    scheduleNext()
  } else {
    clearTimer()
  }
})

self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string }
  if (syncEvent.tag !== PERIODIC_TAG) return
  syncEvent.waitUntil(showReminder())
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target =
    (event.notification.data as { url?: string } | undefined)?.url || '/inicio'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          const windowClient = client as WindowClient
          if ('navigate' in windowClient && typeof windowClient.navigate === 'function') {
            void windowClient.navigate(target)
          }
          void windowClient.focus()
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target)
      }
    }),
  )
})
