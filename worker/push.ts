import type { PushSubscription } from 'web-push'
import webpush from 'web-push'
import type { Context } from 'hono'
import { getSessionUser } from './auth'
import { randomId } from './crypto'
import { badRequest, json, readJson, unauthorized } from './http'
import type { Env, SyncPayload } from './types'

type AppEnv = { Bindings: Env }

type PushRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  tz_offset_minutes: number
  last_sent_at: string | null
}

const MAX_ENDPOINT_LENGTH = 2048
const MIN_TZ_OFFSET = -14 * 60
const MAX_TZ_OFFSET = 14 * 60

export function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false
  const value = endpoint.trim()
  if (!value || value.length > MAX_ENDPOINT_LENGTH) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidPushKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  if (!key.trim() || key.length > 1024) return false
  return /^[A-Za-z0-9\-_]+$/.test(key)
}

export function normalizeTzOffset(value: unknown): number | null {
  if (value === undefined || value === null) return 0
  if (!Number.isInteger(value)) return null
  if (value < MIN_TZ_OFFSET || value > MAX_TZ_OFFSET) return null
  return value
}

export function localeFromValue(value: unknown): 'pt-BR' | 'en' {
  return value === 'en' ? 'en' : 'pt-BR'
}

export function reminderCopy(
  locale: 'pt-BR' | 'en',
  nickname: string,
  remaining: number,
) {
  if (locale === 'en') {
    return {
      title: 'Time to drink water',
      body:
        remaining > 0
          ? `${nickname}, ${remaining} ml left to hit your goal.`
          : `${nickname}, how about logging a sip?`,
      testTitle: 'Water Notes Test',
      testBody: 'Remote push is working.',
    }
  }
  return {
    title: 'Hora de beber água',
    body:
      remaining > 0
        ? `${nickname}, faltam ${remaining} ml para a meta.`
        : `${nickname}, que tal registrar um gole?`,
    testTitle: 'Teste Water Notes',
    testBody: 'Push remoto funcionando.',
  }
}

function configureVapid(env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID não configurado')
  }
  webpush.setVapidDetails(
    env.VAPID_SUBJECT || 'mailto:support@water-notes.app',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )
}

export function getVapidPublicKey(c: Context<AppEnv>) {
  const key = c.env.VAPID_PUBLIC_KEY
  if (!key) return json({ publicKey: null })
  return json({ publicKey: key })
}

export async function subscribePush(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  const body = await readJson<{
    endpoint: string
    keys: { p256dh: string; auth: string }
    tzOffsetMinutes?: number
  }>(c.req.raw)

  const endpoint = body?.endpoint?.trim()
  const p256dh = body?.keys?.p256dh?.trim()
  const auth = body?.keys?.auth?.trim()
  const tzOffsetMinutes = normalizeTzOffset(body?.tzOffsetMinutes)

  if (
    !isValidPushEndpoint(endpoint) ||
    !isValidPushKey(p256dh) ||
    !isValidPushKey(auth) ||
    tzOffsetMinutes == null
  ) {
    return badRequest('Subscription inválida')
  }

  const id = randomId(16)
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, tz_offset_minutes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       tz_offset_minutes = excluded.tz_offset_minutes`,
  )
    .bind(
      id,
      user.id,
      endpoint,
      p256dh,
      auth,
      tzOffsetMinutes,
      now,
    )
    .run()

  return json({ ok: true })
}

export async function unsubscribePush(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  const body = await c.req.json<{ endpoint?: string }>().catch(() => null)
  if (body?.endpoint) {
    if (!isValidPushEndpoint(body.endpoint)) {
      return badRequest('Endpoint inválido')
    }
    await c.env.DB.prepare(
      `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`,
    )
      .bind(user.id, body.endpoint)
      .run()
  } else {
    await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`)
      .bind(user.id)
      .run()
  }
  return json({ ok: true })
}

async function sendToSubscription(
  env: Env,
  row: PushRow,
  payload: object,
) {
  configureVapid(env)
  const subscription: PushSubscription = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }
  await webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 3600,
  })
}

export async function testPush(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  try {
    configureVapid(c.env)
  } catch {
    return badRequest('Push remoto não configurado no servidor')
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, endpoint, p256dh, auth, tz_offset_minutes, last_sent_at
     FROM push_subscriptions WHERE user_id = ?`,
  )
    .bind(user.id)
    .all<PushRow>()

  const list = rows.results ?? []
  if (!list.length) return badRequest('Nenhuma inscrição push neste aparelho')

  let locale: 'pt-BR' | 'en' = 'pt-BR'
  const syncRow = await c.env.DB.prepare(
    `SELECT payload FROM user_data WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<{ payload: string }>()
  if (syncRow?.payload) {
    try {
      const payload = JSON.parse(syncRow.payload) as { locale?: string }
      locale = localeFromValue(payload.locale)
    } catch {
      locale = 'pt-BR'
    }
  }
  const copy = reminderCopy(locale, 'Water Notes', 0)

  await Promise.all(
    list.map((row) =>
      sendToSubscription(c.env, row, {
        title: copy.testTitle,
        body: copy.testBody,
        url: '/ajustes',
      }),
    ),
  )

  return json({ ok: true, sent: list.length })
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function dayKeyFromDate(date: Date): 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  return keys[date.getDay()] ?? 'sun'
}

function isWithinWindow(
  nowM: number,
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): boolean {
  const start = startH * 60 + startM
  const end = endH * 60 + endM
  if (start === end) return true
  if (start < end) return nowM >= start && nowM < end
  return nowM >= start || nowM < end
}

function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type ScheduledNotificationSettings = {
  enabled?: boolean
  intervalMinutes?: number
  windowStartHour?: number
  windowStartMinute?: number
  windowEndHour?: number
  windowEndMinute?: number
  useWeekdayWindows?: boolean
  weeklyWindows?: Partial<
    Record<
      'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat',
      {
        startHour?: number
        startMinute?: number
        endHour?: number
        endMinute?: number
      }
    >
  >
  adaptiveEnabled?: boolean
  pauseWhenGoalReached?: boolean
}

function activeWindowForDay(
  notifications: ScheduledNotificationSettings,
  date: Date,
): { startHour: number; startMinute: number; endHour: number; endMinute: number } {
  const fallback = {
    startHour: notifications.windowStartHour ?? 8,
    startMinute: notifications.windowStartMinute ?? 0,
    endHour: notifications.windowEndHour ?? 22,
    endMinute: notifications.windowEndMinute ?? 0,
  }
  if (!notifications.useWeekdayWindows) return fallback
  const dayWindow = notifications.weeklyWindows?.[dayKeyFromDate(date)]
  if (!dayWindow) return fallback
  return {
    startHour: dayWindow.startHour ?? fallback.startHour,
    startMinute: dayWindow.startMinute ?? fallback.startMinute,
    endHour: dayWindow.endHour ?? fallback.endHour,
    endMinute: dayWindow.endMinute ?? fallback.endMinute,
  }
}

function adaptiveIntervalMs(
  notifications: ScheduledNotificationSettings,
  entries: { ml: number; at: string }[],
  nowUtc: number,
): number {
  const baseMs = Math.max(1, notifications.intervalMinutes ?? 60) * 60_000
  if (notifications.adaptiveEnabled === false) return baseMs
  const lastEntryAt = entries
    .map((entry) => new Date(entry.at).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => b - a)[0]
  if (!lastEntryAt) return Math.min(4 * 60 * 60 * 1000, Math.round(baseMs * 1.25))
  const diff = nowUtc - lastEntryAt
  if (diff <= 90 * 60 * 1000) {
    return Math.max(15 * 60 * 1000, Math.round(baseMs * 0.75))
  }
  if (diff >= 6 * 60 * 60 * 1000) {
    return Math.min(4 * 60 * 60 * 1000, Math.round(baseMs * 1.5))
  }
  return baseMs
}

function todayConsumed(payload: SyncPayload, today: string): number {
  const entries = (payload.entries as { ml: number; at: string }[]) ?? []
  return entries
    .filter((e) => localDateKey(new Date(e.at)) === today)
    .reduce((sum, e) => sum + e.ml, 0)
}

function dailyGoal(payload: SyncPayload, dateKey: string): number {
  const profile = payload.profile as {
    weightKg?: number
    goalOverrideMl?: number | null
    activityLevel?: 'low' | 'moderate' | 'high'
    heatLevel?: 'mild' | 'warm' | 'hot'
    climateAdjustmentMl?: number
    weekdayGoalMl?: number | null
    weekendGoalMl?: number | null
  }
  const date = new Date(`${dateKey}T12:00:00`)
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  const dayOverride = isWeekend ? profile.weekendGoalMl : profile.weekdayGoalMl
  if (dayOverride != null && dayOverride > 0) return Math.round(dayOverride)
  const override = profile?.goalOverrideMl
  const weight = profile?.weightKg ?? 70
  const base = override != null && override > 0 ? Math.round(override) : Math.round(Math.max(0, weight) * 35)
  const activity =
    profile.activityLevel === 'high'
      ? 500
      : profile.activityLevel === 'moderate'
        ? 250
        : 0
  const heat =
    profile.heatLevel === 'hot'
      ? 400
      : profile.heatLevel === 'warm'
        ? 200
        : 0
  const climate = Number.isFinite(profile.climateAdjustmentMl)
    ? Math.round(profile.climateAdjustmentMl ?? 0)
    : 0
  const total = base + activity + heat + climate
  if (total <= 0) return 0
  return total
}

export async function runScheduledPushReminders(env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return

  const { results } = await env.DB.prepare(
    `SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth, ps.tz_offset_minutes, ps.last_sent_at,
            ud.payload
     FROM push_subscriptions ps
     JOIN user_data ud ON ud.user_id = ps.user_id`,
  ).all<PushRow & { payload: string }>()

  const nowUtc = Date.now()

  for (const row of results ?? []) {
    try {
      const payload = JSON.parse(row.payload) as SyncPayload
      const notifications = payload.notifications as ScheduledNotificationSettings

      if (!notifications?.enabled) continue

      const localNow = new Date(nowUtc + row.tz_offset_minutes * 60_000)
      const nowM = minutesOfDay(localNow)
      const window = activeWindowForDay(notifications, localNow)
      if (
        !isWithinWindow(
          nowM,
          window.startHour,
          window.startMinute,
          window.endHour,
          window.endMinute,
        )
      ) {
        continue
      }

      const today = localDateKey(localNow)
      const entries = (payload.entries as { ml: number; at: string }[]) ?? []
      const goal = dailyGoal(payload, today)
      const consumed = todayConsumed(payload, today)
      const goalReached = goal > 0 && consumed >= goal
      if (notifications.pauseWhenGoalReached !== false && goalReached) continue

      const intervalMs = adaptiveIntervalMs(notifications, entries, nowUtc)
      if (row.last_sent_at) {
        const last = new Date(row.last_sent_at).getTime()
        if (nowUtc - last < intervalMs) continue
      }

      const locale = localeFromValue((payload as { locale?: unknown }).locale)
      const profile = payload.profile as { nickname?: string }
      const fallbackNickname = locale === 'en' ? 'there' : 'você'
      const nickname = profile?.nickname?.trim() || fallbackNickname
      const remaining = Math.max(0, goal - consumed)
      const copy = reminderCopy(locale, nickname, remaining)

      await sendToSubscription(env, row, {
        title: copy.title,
        body: copy.body,
        url: '/inicio',
      })

      await env.DB.prepare(
        `UPDATE push_subscriptions SET last_sent_at = ? WHERE id = ?`,
      )
        .bind(new Date(nowUtc).toISOString(), row.id)
        .run()
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`)
          .bind(row.id)
          .run()
      }
    }
  }
}
