/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

type ReminderConfig = {
  enabled: boolean
  intervalMinutes: number
  locale: 'pt-BR' | 'en'
  nickname: string
  remainingMl: number
  goalReached: boolean
  windowStartHour: number
  windowStartMinute: number
  windowEndHour: number
  windowEndMinute: number
  useWeekdayWindows: boolean
  weeklyWindows: Record<
    'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat',
    {
      startHour: number
      startMinute: number
      endHour: number
      endMinute: number
    }
  >
  adaptiveEnabled: boolean
  lastEntryAt: string | null
  pauseWhenGoalReached: boolean
}

let config: ReminderConfig = {
  enabled: false,
  intervalMinutes: 60,
  locale: 'pt-BR',
  nickname: 'você',
  remainingMl: 0,
  goalReached: false,
  windowStartHour: 8,
  windowStartMinute: 0,
  windowEndHour: 22,
  windowEndMinute: 0,
  useWeekdayWindows: false,
  weeklyWindows: {
    sun: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
    mon: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
    tue: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
    wed: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
    thu: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
    fri: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
    sat: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
  },
  adaptiveEnabled: true,
  lastEntryAt: null,
  pauseWhenGoalReached: true,
}

let timer: ReturnType<typeof setTimeout> | undefined

const PERIODIC_TAG = 'water-reminder'

function reminderCopy(locale: 'pt-BR' | 'en', nickname: string, remainingMl: number) {
  if (locale === 'en') {
    return {
      title: 'Time to drink water',
      body:
        remainingMl > 0
          ? `${nickname}, ${remainingMl} ml left to hit your goal.`
          : `${nickname}, how about logging a sip?`,
      testTitle: 'Water Notes Test',
      testBody: 'If you saw this, notifications are working.',
    }
  }
  return {
    title: 'Hora de beber água',
    body:
      remainingMl > 0
        ? `${nickname}, faltam ${remainingMl} ml para a meta.`
        : `${nickname}, que tal registrar um gole?`,
    testTitle: 'Teste Water Notes',
    testBody: 'Se você viu isso, as notificações estão ok.',
  }
}

function minutesOfDay(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

function dayKeyFromDate(date: Date): keyof ReminderConfig['weeklyWindows'] {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  return keys[date.getDay()] ?? 'sun'
}

function activeWindow(date: Date) {
  if (!config.useWeekdayWindows) {
    return {
      startHour: config.windowStartHour,
      startMinute: config.windowStartMinute,
      endHour: config.windowEndHour,
      endMinute: config.windowEndMinute,
    }
  }
  return config.weeklyWindows[dayKeyFromDate(date)]
}

function isWithinWindow(now = new Date()): boolean {
  const nowM = minutesOfDay(now)
  const window = activeWindow(now)
  const start = window.startHour * 60 + window.startMinute
  const end = window.endHour * 60 + window.endMinute
  if (start === end) return true
  if (start < end) return nowM >= start && nowM < end
  return nowM >= start || nowM < end
}

function adaptiveIntervalMs(now = Date.now()): number {
  const baseMs = Math.max(1, config.intervalMinutes) * 60 * 1000
  if (!config.adaptiveEnabled || !config.lastEntryAt) return baseMs
  const last = new Date(config.lastEntryAt).getTime()
  if (Number.isNaN(last)) return baseMs
  const diff = now - last
  if (diff <= 90 * 60 * 1000) return Math.max(15 * 60 * 1000, Math.round(baseMs * 0.75))
  if (diff >= 6 * 60 * 60 * 1000) return Math.min(4 * 60 * 60 * 1000, Math.round(baseMs * 1.5))
  return baseMs
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

function applyReminderPatch(data: Partial<ReminderConfig>) {
  config = {
    enabled: data.enabled ?? config.enabled,
    intervalMinutes: Number(data.intervalMinutes) || config.intervalMinutes,
    locale: data.locale === 'en' ? 'en' : config.locale,
    nickname: data.nickname || config.nickname,
    remainingMl: Number(data.remainingMl ?? config.remainingMl),
    goalReached: data.goalReached ?? config.goalReached,
    windowStartHour: Number(data.windowStartHour ?? config.windowStartHour),
    windowStartMinute: Number(data.windowStartMinute ?? config.windowStartMinute),
    windowEndHour: Number(data.windowEndHour ?? config.windowEndHour),
    windowEndMinute: Number(data.windowEndMinute ?? config.windowEndMinute),
    useWeekdayWindows: data.useWeekdayWindows ?? config.useWeekdayWindows,
    weeklyWindows: {
      ...config.weeklyWindows,
      ...(data.weeklyWindows ?? {}),
    },
    adaptiveEnabled: data.adaptiveEnabled ?? config.adaptiveEnabled,
    lastEntryAt:
      typeof data.lastEntryAt === 'string' || data.lastEntryAt === null
        ? data.lastEntryAt
        : config.lastEntryAt,
    pauseWhenGoalReached:
      data.pauseWhenGoalReached ?? config.pauseWhenGoalReached,
  }
}

async function refreshConfigFromClients(): Promise<void> {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  if (!clients.length) return

  await Promise.race([
    new Promise<void>((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = (event: MessageEvent) => {
        const data = event.data as Partial<ReminderConfig> & { type?: string }
        if (data?.type === 'REMINDER_STATE') {
          applyReminderPatch(data)
        }
        resolve()
      }
      for (const client of clients) {
        client.postMessage({ type: 'REQUEST_REMINDER_REFRESH' }, [channel.port2])
      }
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1500)
    }),
  ])
}

async function showReminder() {
  await refreshConfigFromClients()
  if (!shouldNotify()) return

  const copy = reminderCopy(config.locale, config.nickname, config.remainingMl)

  await self.registration.showNotification(copy.title, {
    body: copy.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'water-reminder',
    renotify: true,
    data: { url: '/inicio' },
  })
}

function msUntilNextTick(): number {
  const nowMs = Date.now()
  const intervalMs = adaptiveIntervalMs(nowMs)
  if (isWithinWindow()) return intervalMs

  const now = new Date(nowMs)
  const window = activeWindow(now)
  const start = new Date(now)
  start.setHours(window.startHour, window.startMinute, 0, 0)
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
    const copy = reminderCopy(config.locale, config.nickname, config.remainingMl)
    event.waitUntil(
      self.registration.showNotification(copy.testTitle, {
        body: copy.testBody,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'water-reminder-test',
        data: { url: '/ajustes' },
      }),
    )
    return
  }

  if (data?.type !== 'SET_REMINDERS') return

  applyReminderPatch(data)

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

self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {}
  try {
    payload = event.data?.json() as typeof payload
  } catch {
    payload = { body: event.data?.text() ?? '' }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Water Notes', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'water-remote-push',
      renotify: true,
      data: { url: payload.url || '/inicio' },
    }),
  )
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
