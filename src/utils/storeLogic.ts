import { ML_PER_KG, type DayStat } from '@/types'
import { addDays, localDateKey } from '@/utils/date'

export function resolveDailyGoalMl(
  weightKg: number,
  goalOverrideMl: number | null,
): number {
  if (goalOverrideMl != null && goalOverrideMl > 0) return Math.round(goalOverrideMl)
  return Math.round(Math.max(0, weightKg) * ML_PER_KG)
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
