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

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
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
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
      body.tzOffsetMinutes ?? 0,
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

  await Promise.all(
    list.map((row) =>
      sendToSubscription(c.env, row, {
        title: 'Teste Water Notes',
        body: 'Push remoto funcionando.',
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

      const profile = payload.profile as { nickname?: string }
      const nickname = profile?.nickname?.trim() || 'você'
      const remaining = Math.max(0, goal - consumed)
      const body =
        remaining > 0
          ? `Faltam ${remaining} ml para a meta.`
          : 'Que tal registrar um gole?'

      await sendToSubscription(env, row, {
        title: 'Hora de beber água',
        body: `${nickname}, ${body}`,
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
