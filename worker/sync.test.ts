import { describe, expect, it } from 'vitest'
import { isValidSyncPayload, parseExpectedRevision } from './sync'

const validPayload = {
  profile: {
    nickname: 'Joao',
    weightKg: 70,
    avatarId: 'drop',
    onboarded: true,
    goalOverrideMl: null,
    bedtimeHour: 22,
    bedtimeMinute: 0,
    email: 'joao@example.com',
    photoUrl: null,
    useProfilePhoto: false,
  },
  cups: [{ id: 'cup-250', label: 'Copo', ml: 250 }],
  entries: [{ id: 'e1', ml: 300, at: '2026-08-26T10:00:00.000Z' }],
  theme: 'system',
  notifications: {
    enabled: true,
    intervalMinutes: 60,
    windowStartHour: 8,
    windowStartMinute: 0,
    windowEndHour: 22,
    windowEndMinute: 0,
    pauseWhenGoalReached: true,
  },
  feedback: {
    sound: true,
    haptic: true,
  },
  locale: 'pt-BR',
  celebratedDate: null,
  installDismissedAt: null,
  lastActiveDate: '2026-08-26',
  lastSummaryDate: null,
  dailyGoalSnapshots: {
    '2026-08-26': 2450,
  },
}

describe('isValidSyncPayload', () => {
  it('accepts a valid sync payload', () => {
    expect(isValidSyncPayload(validPayload)).toBe(true)
  })

  it('rejects payload with invalid profile weight', () => {
    expect(
      isValidSyncPayload({
        ...validPayload,
        profile: {
          ...validPayload.profile,
          weightKg: -10,
        },
      }),
    ).toBe(false)
  })

  it('rejects payload with invalid entries date', () => {
    expect(
      isValidSyncPayload({
        ...validPayload,
        entries: [{ id: 'e1', ml: 200, at: 'not-a-date' }],
      }),
    ).toBe(false)
  })

  it('rejects payload with invalid snapshot keys', () => {
    expect(
      isValidSyncPayload({
        ...validPayload,
        dailyGoalSnapshots: {
          '26-08-2026': 2450,
        },
      }),
    ).toBe(false)
  })

  it('accepts advanced profile and reminder settings', () => {
    expect(
      isValidSyncPayload({
        ...validPayload,
        profile: {
          ...validPayload.profile,
          activityLevel: 'high',
          heatLevel: 'warm',
          climateAdjustmentMl: 150,
          weekdayGoalMl: 2600,
          weekendGoalMl: 2200,
          weeklyGoalDays: 5,
        },
        notifications: {
          ...validPayload.notifications,
          useWeekdayWindows: true,
          adaptiveEnabled: true,
          weeklyWindows: {
            sun: { startHour: 9, startMinute: 0, endHour: 20, endMinute: 0 },
            mon: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            tue: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            wed: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            thu: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            fri: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            sat: { startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 },
          },
        },
      }),
    ).toBe(true)
  })

  it('rejects invalid weekday reminder windows', () => {
    expect(
      isValidSyncPayload({
        ...validPayload,
        notifications: {
          ...validPayload.notifications,
          useWeekdayWindows: true,
          weeklyWindows: {
            sun: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            mon: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            tue: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            wed: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            thu: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            fri: { startHour: 8, startMinute: 0, endHour: 22, endMinute: 0 },
            sat: { startHour: 30, startMinute: 0, endHour: 22, endMinute: 0 },
          },
        },
      }),
    ).toBe(false)
  })
})

describe('parseExpectedRevision', () => {
  it('accepts valid revision integers', () => {
    expect(parseExpectedRevision(0)).toBe(0)
    expect(parseExpectedRevision(7)).toBe(7)
  })

  it('rejects invalid revision values', () => {
    expect(parseExpectedRevision(-1)).toBeNull()
    expect(parseExpectedRevision(1.5)).toBeNull()
    expect(parseExpectedRevision('1')).toBeNull()
  })
})
