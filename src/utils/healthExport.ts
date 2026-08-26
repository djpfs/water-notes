import type { WaterEntry } from '@/types'
import { localDateKey } from '@/utils/date'

export type HealthExportFormat = 'csv' | 'json'

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildHealthCsv(entries: WaterEntry[]): string {
  const header = 'date,time,ml,type,source'
  const rows = entries.map((e) => {
    const d = new Date(e.at)
    const date = localDateKey(d)
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return `${date},${time},${e.ml},water,water-notes`
  })
  return [header, ...rows].join('\n')
}

export function buildHealthJson(entries: WaterEntry[]) {
  return {
    schema: 'water-notes-health-export/v1',
    compatibleWith: ['Health Connect importers', 'Apple Health partner apps', 'CSV tools'],
    unit: 'ml',
    type: 'water',
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      id: e.id,
      at: e.at,
      date: localDateKey(new Date(e.at)),
      ml: e.ml,
      hydrationType: 'water',
    })),
  }
}

export function exportHealthData(entries: WaterEntry[], format: HealthExportFormat) {
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'csv') {
    const csv = buildHealthCsv(entries)
    downloadBlob(
      `water-notes-health-${stamp}.csv`,
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    )
    return
  }
  const json = JSON.stringify(buildHealthJson(entries), null, 2)
  downloadBlob(
    `water-notes-health-${stamp}.json`,
    new Blob([json], { type: 'application/json' }),
  )
}

export function detectHealthPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'other'
}
