import { describe, expect, it } from 'vitest'
import {
  buildDayStat,
  computeStreak,
  goalForDateKey,
  missedDayKeys,
  pruneEntriesBefore,
  pruneSnapshotsBefore,
  resolveDailyGoalMl,
  resolveGoalForDate,
} from '@/utils/storeLogic'

describe('resolveDailyGoalMl', () => {
  it('uses weight × 35 when no override', () => {
    expect(resolveDailyGoalMl(70, null)).toBe(2450)
  })

  it('uses override when set', () => {
    expect(resolveDailyGoalMl(70, 2000)).toBe(2000)
  })
})

describe('resolveGoalForDate', () => {
  const profileBase = {
    weightKg: 70,
    goalOverrideMl: null,
    activityLevel: 'moderate' as const,
    heatLevel: 'mild' as const,
    climateAdjustmentMl: 0,
    weekdayGoalMl: null,
    weekendGoalMl: null,
  }

  it('adds profile adjustments to default goal', () => {
    expect(
      resolveGoalForDate({
        ...profileBase,
        activityLevel: 'high',
        heatLevel: 'hot',
        climateAdjustmentMl: 100,
      }, '2026-08-26'),
    ).toBe(3450)
  })

  it('uses weekday/weekend custom goals when defined', () => {
    expect(
      resolveGoalForDate(
        {
          ...profileBase,
          weekdayGoalMl: 2300,
          weekendGoalMl: 1900,
        },
        '2026-08-26',
      ),
    ).toBe(2300)
    expect(
      resolveGoalForDate(
        {
          ...profileBase,
          weekdayGoalMl: 2300,
          weekendGoalMl: 1900,
        },
        '2026-08-30',
      ),
    ).toBe(1900)
  })
})

describe('goalForDateKey', () => {
  it('returns snapshot when present', () => {
    expect(goalForDateKey('2026-08-01', { '2026-08-01': 1800 }, 2450)).toBe(1800)
  })

  it('falls back to current goal', () => {
    expect(goalForDateKey('2026-08-01', {}, 2450)).toBe(2450)
  })
})

describe('buildDayStat', () => {
  it('marks reached when consumed meets goal', () => {
    const stat = buildDayStat(
      '2026-08-01',
      [{ ml: 500, at: '2026-08-01T10:00:00' }],
      500,
    )
    expect(stat.reached).toBe(true)
    expect(stat.consumedMl).toBe(500)
  })
})

describe('computeStreak', () => {
  it('counts consecutive reached days including today', () => {
    const entries = [
      { ml: 3000, at: '2026-08-26T10:00:00' },
      { ml: 3000, at: '2026-08-25T10:00:00' },
    ]
    const snapshots = {
      '2026-08-25': 2500,
      '2026-08-26': 2500,
    }
    expect(
      computeStreak('2026-08-26', entries, snapshots, 2500),
    ).toBe(2)
  })

  it('starts from yesterday when today not reached', () => {
    const entries = [{ ml: 3000, at: '2026-08-25T10:00:00' }]
    const snapshots = { '2026-08-25': 2500, '2026-08-26': 2500 }
    expect(
      computeStreak('2026-08-26', entries, snapshots, 2500),
    ).toBe(1)
  })
})

describe('missedDayKeys', () => {
  it('returns all days between last active and yesterday', () => {
    expect(missedDayKeys('2026-08-22', '2026-08-26')).toEqual([
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
    ])
  })

  it('returns empty when last active is today', () => {
    expect(missedDayKeys('2026-08-26', '2026-08-26')).toEqual([])
  })
})

describe('pruneEntriesBefore', () => {
  it('drops entries older than keep window', () => {
    const entries = [
      { id: 'old', at: '2026-01-01T10:00:00' },
      { id: 'new', at: '2026-08-26T10:00:00' },
    ]
    const kept = pruneEntriesBefore(entries, 90, '2026-08-26')
    expect(kept.map((e) => e.id)).toEqual(['new'])
  })
})

describe('pruneSnapshotsBefore', () => {
  it('drops snapshots older than keep window', () => {
    const snapshots = {
      '2026-01-01': 2000,
      '2026-08-26': 2500,
    }
    const kept = pruneSnapshotsBefore(snapshots, 90, '2026-08-26')
    expect(kept).toEqual({ '2026-08-26': 2500 })
  })
})
