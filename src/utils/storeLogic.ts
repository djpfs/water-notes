import { ML_PER_KG, type DayStat, type Profile } from '@/types'
import { addDays, localDateKey } from '@/utils/date'

export function resolveDailyGoalMl(
  weightKg: number,
  goalOverrideMl: number | null,
): number {
  if (goalOverrideMl != null && goalOverrideMl > 0) return Math.round(goalOverrideMl)
  return Math.round(Math.max(0, weightKg) * ML_PER_KG)
}

function isWeekend(dateKey: string): boolean {
  const date = new Date(`${dateKey}T12:00:00`)
  const day = date.getDay()
  return day === 0 || day === 6
}

export function goalAdjustmentsMl(profile: Pick<
  Profile,
  'activityLevel' | 'heatLevel' | 'climateAdjustmentMl'
>): number {
  const activityBonus =
    profile.activityLevel === 'high'
      ? 500
      : profile.activityLevel === 'moderate'
        ? 250
        : 0
  const heatBonus =
    profile.heatLevel === 'hot' ? 400 : profile.heatLevel === 'warm' ? 200 : 0
  const manual = Number.isFinite(profile.climateAdjustmentMl)
    ? Math.round(profile.climateAdjustmentMl)
    : 0
  return activityBonus + heatBonus + manual
}

export function resolveGoalForDate(
  profile: Pick<
    Profile,
    | 'weightKg'
    | 'goalOverrideMl'
    | 'activityLevel'
    | 'heatLevel'
    | 'climateAdjustmentMl'
    | 'weekdayGoalMl'
    | 'weekendGoalMl'
  >,
  dateKey = localDateKey(),
): number {
  const dayOverride = isWeekend(dateKey) ? profile.weekendGoalMl : profile.weekdayGoalMl
  if (dayOverride != null && dayOverride > 0) return Math.round(dayOverride)
  const base = resolveDailyGoalMl(profile.weightKg, profile.goalOverrideMl)
  return Math.max(0, base + goalAdjustmentsMl(profile))
}

export function goalForDateKey(
  dateKey: string,
  snapshots: Record<string, number>,
  fallbackGoalMl: number,
): number {
  const snap = snapshots[dateKey]
  if (snap != null && snap > 0) return snap
  return fallbackGoalMl
}

export function consumedOnDate(
  entries: { ml: number; at: string }[],
  dateKey: string,
): number {
  return entries
    .filter((e) => localDateKey(new Date(e.at)) === dateKey)
    .reduce((sum, e) => sum + e.ml, 0)
}

export function buildDayStat(
  dateKey: string,
  entries: { ml: number; at: string }[],
  goalMl: number,
): DayStat {
  const consumedMl = consumedOnDate(entries, dateKey)
  return {
    date: dateKey,
    consumedMl,
    goalMl,
    reached: goalMl > 0 && consumedMl >= goalMl,
  }
}

export function computeStreak(
  todayKey: string,
  entries: { ml: number; at: string }[],
  snapshots: Record<string, number>,
  fallbackGoalMl: number,
): number {
  let count = 0
  let cursor = todayKey
  const today = buildDayStat(
    cursor,
    entries,
    goalForDateKey(cursor, snapshots, fallbackGoalMl),
  )
  if (!today.reached) cursor = addDays(cursor, -1)

  for (let i = 0; i < 365; i += 1) {
    const stat = buildDayStat(
      cursor,
      entries,
      goalForDateKey(cursor, snapshots, fallbackGoalMl),
    )
    if (!stat.reached) break
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

export function missedDayKeys(
  lastActiveDate: string | null,
  today = localDateKey(),
): string[] {
  if (!lastActiveDate || lastActiveDate >= today) return []
  const keys: string[] = []
  let cursor = addDays(lastActiveDate, 1)
  const yesterday = addDays(today, -1)
  while (cursor <= yesterday) {
    keys.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return keys
}

export function pruneEntriesBefore<T extends { at: string }>(
  entries: T[],
  keepDays: number,
  today = localDateKey(),
): T[] {
  const cutoff = addDays(today, -(keepDays - 1))
  return entries.filter((e) => localDateKey(new Date(e.at)) >= cutoff)
}

export function pruneSnapshotsBefore(
  snapshots: Record<string, number>,
  keepDays: number,
  today = localDateKey(),
): Record<string, number> {
  const cutoff = addDays(today, -(keepDays - 1))
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(snapshots)) {
    if (key >= cutoff) next[key] = value
  }
  return next
}
