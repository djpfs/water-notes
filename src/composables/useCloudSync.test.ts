import { describe, expect, it } from 'vitest'
import type { Cup, WaterEntry } from '@/types'

function mergeEntries(local: WaterEntry[], remote: WaterEntry[]): WaterEntry[] {
  const map = new Map<string, WaterEntry>()
  for (const e of local) map.set(e.id, e)
  for (const e of remote) map.set(e.id, e)
  return [...map.values()]
}

describe('mergeEntries', () => {
  it('keeps entries unique to each device', () => {
    const local: WaterEntry[] = [
      { id: 'a', ml: 200, at: '2026-08-26T10:00:00.000Z' },
    ]
    const remote: WaterEntry[] = [
      { id: 'b', ml: 300, at: '2026-08-26T11:00:00.000Z' },
    ]
    const merged = mergeEntries(local, remote)
    expect(merged).toHaveLength(2)
    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('prefers remote when the same entry id exists on both sides', () => {
    const local: WaterEntry[] = [
      { id: 'a', ml: 200, at: '2026-08-26T10:00:00.000Z' },
    ]
    const remote: WaterEntry[] = [
      { id: 'a', ml: 250, at: '2026-08-26T10:05:00.000Z' },
    ]
    const merged = mergeEntries(local, remote)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.ml).toBe(250)
  })
})

describe('mergeCups', () => {
  function mergeCups(local: Cup[], remote: Cup[]): Cup[] {
    const map = new Map<string, Cup>()
    for (const c of local) map.set(c.id, c)
    for (const c of remote) map.set(c.id, c)
    return [...map.values()]
  }

  it('merges custom cups from remote', () => {
    const local: Cup[] = [{ id: '1', label: 'Copo', ml: 200 }]
    const remote: Cup[] = [
      { id: '1', label: 'Copo', ml: 200 },
      { id: '2', label: 'Garrafa', ml: 500 },
    ]
    expect(mergeCups(local, remote)).toHaveLength(2)
  })
})
