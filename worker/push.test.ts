import { describe, expect, it } from 'vitest'
import {
  isValidPushEndpoint,
  isValidPushKey,
  localeFromValue,
  normalizeTzOffset,
  reminderCopy,
} from './push'

describe('push subscription validation', () => {
  it('accepts valid https endpoint', () => {
    expect(
      isValidPushEndpoint('https://fcm.googleapis.com/fcm/send/abc123'),
    ).toBe(true)
  })

  it('rejects non-https endpoint', () => {
    expect(
      isValidPushEndpoint('http://fcm.googleapis.com/fcm/send/abc123'),
    ).toBe(false)
  })

  it('accepts valid push keys', () => {
    expect(isValidPushKey('BIPw1V2_-abcXYZ')).toBe(true)
  })

  it('rejects invalid push keys', () => {
    expect(isValidPushKey('')).toBe(false)
    expect(isValidPushKey('abc+def')).toBe(false)
  })

  it('normalizes timezone offsets with bounds', () => {
    expect(normalizeTzOffset(undefined)).toBe(0)
    expect(normalizeTzOffset(180)).toBe(180)
    expect(normalizeTzOffset(900)).toBeNull()
  })
})

describe('push localization helpers', () => {
  it('resolves locale fallback', () => {
    expect(localeFromValue('en')).toBe('en')
    expect(localeFromValue('pt-BR')).toBe('pt-BR')
    expect(localeFromValue('fr')).toBe('pt-BR')
  })

  it('builds localized reminder copy', () => {
    expect(reminderCopy('pt-BR', 'Joao', 500).title).toBe('Hora de beber água')
    expect(reminderCopy('en', 'John', 0).title).toBe('Time to drink water')
  })
})
