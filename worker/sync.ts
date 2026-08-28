import type { Context } from 'hono'
import { getSessionUser } from './auth'
import { badRequest, json, readJson, unauthorized } from './http'
import type { Env, SyncPayload } from './types'

type AppEnv = { Bindings: Env }
type JsonRecord = Record<string, unknown>

const MAX_SYNC_PAYLOAD_BYTES = 1_000_000
const MAX_ENTRIES = 10_000
const MAX_CUPS = 200
const MAX_SNAPSHOTS = 730

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isString(value: unknown, max = 512): value is string {
  return typeof value === 'string' && value.length <= max
}

function isNullableString(value: unknown, max = 512): value is string | null {
  return value === null || isString(value, max)
}

function isValidLocale(value: unknown): boolean {
  return value === 'pt-BR' || value === 'en'
}

function isValidTheme(value: unknown): boolean {
  return value === 'system' || value === 'light' || value === 'dark'
}

function isValidProfile(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isString(value.nickname, 64)) return false
  if (!isFiniteNumber(value.weightKg) || value.weightKg < 0 || value.weightKg > 500) {
    return false
  }
  if (!isString(value.avatarId, 64)) return false
  if (!isBoolean(value.onboarded)) return false
  if (
    !(
      value.goalOverrideMl === null ||
      (isFiniteNumber(value.goalOverrideMl) &&
        value.goalOverrideMl >= 0 &&
        value.goalOverrideMl <= 20_000)
    )
  ) {
    return false
  }
  if (
    !isFiniteNumber(value.bedtimeHour) ||
    value.bedtimeHour < 0 ||
    value.bedtimeHour > 23
  ) {
    return false
  }
  if (
    !isFiniteNumber(value.bedtimeMinute) ||
    value.bedtimeMinute < 0 ||
    value.bedtimeMinute > 59
  ) {
    return false
  }
  if (!isNullableString(value.email, 320)) return false
  if (!isNullableString(value.photoUrl, 4096)) return false
  if (!isBoolean(value.useProfilePhoto)) return false
  if (
    !(
      value.activityLevel === undefined ||
      value.activityLevel === 'low' ||
      value.activityLevel === 'moderate' ||
      value.activityLevel === 'high'
    )
  ) {
    return false
  }
  if (
    !(
      value.heatLevel === undefined ||
      value.heatLevel === 'mild' ||
      value.heatLevel === 'warm' ||
      value.heatLevel === 'hot'
    )
  ) {
    return false
  }
  if (
    !(
      value.climateAdjustmentMl === undefined ||
      (isFiniteNumber(value.climateAdjustmentMl) &&
        value.climateAdjustmentMl >= -2000 &&
        value.climateAdjustmentMl <= 2000)
    )
  ) {
    return false
  }
  const isNullableGoal = (goal: unknown) =>
    goal === undefined ||
    goal === null ||
    (isFiniteNumber(goal) && goal >= 0 && goal <= 20_000)
  if (!isNullableGoal(value.weekdayGoalMl)) return false
  if (!isNullableGoal(value.weekendGoalMl)) return false
  if (
    !(
      value.weeklyGoalDays === undefined ||
      (isFiniteNumber(value.weeklyGoalDays) &&
        value.weeklyGoalDays >= 1 &&
        value.weeklyGoalDays <= 7)
    )
  ) {
    return false
  }
  return true
}

function isValidCup(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isString(value.id, 128) || !value.id.trim()) return false
  if (!isString(value.label, 64)) return false
  if (!isFiniteNumber(value.ml) || value.ml <= 0 || value.ml > 5000) return false
  return true
}

function isValidEntry(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isString(value.id, 128) || !value.id.trim()) return false
  if (!isFiniteNumber(value.ml) || value.ml <= 0 || value.ml > 5000) return false
  if (!isString(value.at, 64)) return false
  const date = new Date(value.at)
  return !Number.isNaN(date.getTime())
}

function isValidNotifications(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isBoolean(value.enabled)) return false
  if (
    !isFiniteNumber(value.intervalMinutes) ||
    value.intervalMinutes < 1 ||
    value.intervalMinutes > 24 * 60
  ) {
    return false
  }

  const windowBounds = [
    ['windowStartHour', 0, 23],
    ['windowStartMinute', 0, 59],
    ['windowEndHour', 0, 23],
    ['windowEndMinute', 0, 59],
  ] as const
  for (const [field, min, max] of windowBounds) {
    const current = value[field]
    if (!isFiniteNumber(current) || current < min || current > max) return false
  }

  if (
    !(
      value.useWeekdayWindows === undefined ||
      isBoolean(value.useWeekdayWindows)
    )
  ) {
    return false
  }
  if (
    !(
      value.adaptiveEnabled === undefined ||
      isBoolean(value.adaptiveEnabled)
    )
  ) {
    return false
  }
  if (value.weeklyWindows !== undefined) {
    if (!isRecord(value.weeklyWindows)) return false
    for (const key of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
      const dayWindow = value.weeklyWindows[key]
      if (!isRecord(dayWindow)) return false
      const fields = [
        ['startHour', 0, 23],
        ['startMinute', 0, 59],
        ['endHour', 0, 23],
        ['endMinute', 0, 59],
      ] as const
      for (const [field, min, max] of fields) {
        const current = dayWindow[field]
        if (!isFiniteNumber(current) || current < min || current > max) return false
      }
    }
  }

  return isBoolean(value.pauseWhenGoalReached)
}

function isValidFeedback(value: unknown): boolean {
  if (!isRecord(value)) return false
  return isBoolean(value.sound) && isBoolean(value.haptic)
}

function isValidSnapshots(value: unknown): value is Record<string, number> {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  if (entries.length > MAX_SNAPSHOTS) return false
  for (const [key, val] of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
    if (!isFiniteNumber(val) || val < 0 || val > 20_000) return false
  }
  return true
}

export function isValidSyncPayload(value: unknown): value is SyncPayload {
  if (!isRecord(value)) return false
  if (!isValidProfile(value.profile)) return false
  if (!Array.isArray(value.cups) || value.cups.length > MAX_CUPS) return false
  if (!value.cups.every((cup) => isValidCup(cup))) return false
  if (!Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES) return false
  if (!value.entries.every((entry) => isValidEntry(entry))) return false
  if (!isValidTheme(value.theme)) return false
  if (!isValidNotifications(value.notifications)) return false
  if (!(value.feedback === undefined || isValidFeedback(value.feedback))) return false
  if (!isNullableString(value.celebratedDate, 64)) return false
  if (!isNullableString(value.installDismissedAt, 64)) return false
  if (!isNullableString(value.lastActiveDate, 64)) return false
  if (!isNullableString(value.lastSummaryDate, 64)) return false
  if (!isValidSnapshots(value.dailyGoalSnapshots)) return false
  if (!(value.locale === undefined || isValidLocale(value.locale))) return false
  return true
}

export function parseExpectedRevision(value: unknown): number | null {
  if (value === undefined) return null
  if (!Number.isInteger(value) || value < 0) return null
  return value
}

export async function getSync(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  const row = await c.env.DB.prepare(
    `SELECT payload, updated_at, revision FROM user_data WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<{ payload: string; updated_at: string; revision: number }>()

  if (!row) {
    return json({ data: null, revision: 0, updatedAt: null })
  }

  return json({
    data: JSON.parse(row.payload) as SyncPayload,
    revision: row.revision,
    updatedAt: row.updated_at,
  })
}

export async function putSync(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  const body = await readJson<{ data?: unknown; revision?: unknown }>(c.req.raw)
  if (!body || !isValidSyncPayload(body.data)) return badRequest('Payload inválido')
  const expectedRevision = parseExpectedRevision(body.revision)
  if (body.revision !== undefined && expectedRevision === null) {
    return badRequest('Revision inválida')
  }

  const existing = await c.env.DB.prepare(
    `SELECT revision, updated_at FROM user_data WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<{ revision: number; updated_at: string }>()

  const currentRevision = existing?.revision ?? 0
  if (
    expectedRevision !== null &&
    expectedRevision !== currentRevision
  ) {
    return json(
      {
        error: 'Conflito de sincronização.',
        code: 'REVISION_CONFLICT',
        currentRevision,
        updatedAt: existing?.updated_at ?? null,
      },
      { status: 409 },
    )
  }

  const nextRevision = currentRevision + 1
  const now = new Date().toISOString()
  const payload = JSON.stringify(body.data)
  if (payload.length > MAX_SYNC_PAYLOAD_BYTES) {
    return badRequest('Payload muito grande')
  }

  await c.env.DB.prepare(
    `INSERT INTO user_data (user_id, payload, updated_at, revision)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at,
       revision = excluded.revision`,
  )
    .bind(user.id, payload, now, nextRevision)
    .run()

  return json({ ok: true, revision: nextRevision, updatedAt: now })
}
