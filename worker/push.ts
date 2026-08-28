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

function todayConsumed(payload: SyncPayload, today: string): number {
  const entries = (payload.entries as { ml: number; at: string }[]) ?? []
  return entries
    .filter((e) => localDateKey(new Date(e.at)) === today)
    .reduce((sum, e) => sum + e.ml, 0)
}

function dailyGoal(payload: SyncPayload): number {
  const profile = payload.profile as {
    weightKg?: number
    goalOverrideMl?: number | null
  }
  const override = profile?.goalOverrideMl
  if (override != null && override > 0) return Math.round(override)
  const weight = profile?.weightKg ?? 70
  return Math.round(Math.max(0, weight) * 35)
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
      const notifications = payload.notifications as {
        enabled?: boolean
        intervalMinutes?: number
        windowStartHour?: number
        windowStartMinute?: number
        windowEndHour?: number
        windowEndMinute?: number
        pauseWhenGoalReached?: boolean
      }

      if (!notifications?.enabled) continue

      const localNow = new Date(nowUtc + row.tz_offset_minutes * 60_000)
      const nowM = minutesOfDay(localNow)
      if (
        !isWithinWindow(
          nowM,
          notifications.windowStartHour ?? 8,
          notifications.windowStartMinute ?? 0,
          notifications.windowEndHour ?? 22,
          notifications.windowEndMinute ?? 0,
        )
      ) {
        continue
      }

      const today = localDateKey(localNow)
      const goal = dailyGoal(payload)
      const consumed = todayConsumed(payload, today)
      const goalReached = goal > 0 && consumed >= goal
      if (notifications.pauseWhenGoalReached !== false && goalReached) continue

      const intervalMs = Math.max(1, notifications.intervalMinutes ?? 60) * 60_000
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
