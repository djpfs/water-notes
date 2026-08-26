export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, delta: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + delta)
  return localDateKey(date)
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatVolume(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${liters.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`
  }
  return `${Math.round(ml)} ml`
}

export function formatDayLabel(key: string): string {
  return parseDateKey(key).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

/** Legenda curta para gráfico (7 = dia da semana, 30 = dia do mês). */
export function formatChartDayLabel(key: string, range: 7 | 30): string {
  const date = parseDateKey(key)
  if (range <= 7) {
    return date
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', '')
      .slice(0, 3)
  }
  return String(date.getDate())
}

/** Hours remaining until bedtime today (or tomorrow if already past). Min 0.25. */
export function hoursUntilBedtime(hour: number, minute: number, now = new Date()): number {
  const bed = new Date(now)
  bed.setHours(hour, minute, 0, 0)
  if (bed.getTime() <= now.getTime()) {
    bed.setDate(bed.getDate() + 1)
  }
  return Math.max(0.25, (bed.getTime() - now.getTime()) / (1000 * 60 * 60))
}

export function snapMl(ml: number, step = 50): number {
  if (ml <= 0) return 0
  return Math.max(step, Math.round(ml / step) * step)
}
