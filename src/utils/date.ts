export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
