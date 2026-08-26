/** Minutes since local midnight. */
export function minutesOfDay(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function isWithinTimeWindow(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  now = new Date(),
): boolean {
  const nowM = minutesOfDay(now)
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  if (start === end) return true
  if (start < end) return nowM >= start && nowM < end
  // Cruza meia-noite
  return nowM >= start || nowM < end
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseClock(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map(Number)
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  }
}
