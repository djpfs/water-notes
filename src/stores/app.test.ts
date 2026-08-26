import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/app'
import { localDateKey } from '@/utils/date'

describe('useAppStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00'))
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('snapshots today goal on first entry', () => {
    const store = useAppStore()
    store.updateProfile({ weightKg: 80, goalOverrideMl: null })
    store.addEntry(250)
    expect(store.dailyGoalSnapshots[localDateKey()]).toBe(2800)
  })

  it('uses snapshot for historical day stat', () => {
    const store = useAppStore()
    store.dailyGoalSnapshots['2026-08-20'] = 2000
    store.entries.push({
      id: 'e1',
      ml: 2100,
      at: '2026-08-20T12:00:00',
    })
    const stat = store.dayStat('2026-08-20')
    expect(stat.goalMl).toBe(2000)
    expect(stat.reached).toBe(true)
  })

  it('exports and imports backup with snapshots', () => {
    const store = useAppStore()
    store.completeOnboarding({
      nickname: 'Teste',
      weightKg: 70,
      avatarId: 'drop',
    })
    store.addEntry(200)
    store.dailyGoalSnapshots['2026-08-01'] = 1800
    const backup = store.exportBackup()
    store.resetAll()
    store.importBackup(backup)
    expect(store.profile.nickname).toBe('Teste')
    expect(store.dailyGoalSnapshots['2026-08-01']).toBe(1800)
    expect(store.entries.length).toBe(1)
  })

  it('returns missed summaries for gap days', () => {
    const store = useAppStore()
    store.lastActiveDate = '2026-08-23'
    store.lastSummaryDate = null
    store.dailyGoalSnapshots['2026-08-24'] = 2450
    store.dailyGoalSnapshots['2026-08-25'] = 2450
    store.entries.push({
      id: 'e1',
      ml: 500,
      at: '2026-08-24T10:00:00',
    })

    const summaries = store.peekMissedSummaries()
    expect(summaries.map((s) => s.date)).toEqual([
      '2026-08-24',
      '2026-08-25',
    ])
    expect(summaries[0].consumedMl).toBe(500)
  })
})
