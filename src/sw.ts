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
}

let config: ReminderConfig = {
  enabled: false,
  intervalMinutes: 60,
  nickname: 'você',
  remainingMl: 0,
  goalReached: false,
}

let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

async function showReminder() {
  if (!config.enabled || config.goalReached) return

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
    data: { url: '/' },
  })
}

function scheduleNext() {
  clearTimer()
  if (!config.enabled) return
  const ms = Math.max(1, config.intervalMinutes) * 60 * 1000
  timer = setTimeout(async () => {
    await showReminder()
    scheduleNext()
  }, ms)
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } & Partial<ReminderConfig>
  if (data?.type !== 'SET_REMINDERS') return

  config = {
    enabled: Boolean(data.enabled),
    intervalMinutes: Number(data.intervalMinutes) || 60,
    nickname: data.nickname || 'você',
    remainingMl: Number(data.remainingMl) || 0,
    goalReached: Boolean(data.goalReached),
  }

  if (config.enabled) {
    scheduleNext()
  } else {
    clearTimer()
  }
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | undefined)?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.focus()
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target)
      }
    }),
  )
})
