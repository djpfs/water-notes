import { useAppStore } from '@/stores/app'
import { formatVolume } from '@/utils/date'

export async function shareDailyProgress(): Promise<'shared' | 'copied'> {
  const store = useAppStore()
  const pct = Math.round(store.progress * 100)
  const text = [
    `Water Notes — ${store.profile.nickname || 'hoje'}`,
    `${formatVolume(store.todayConsumedMl)} de ${formatVolume(store.dailyGoalMl)} (${pct}%)`,
    store.streak > 0
      ? `Sequência: ${store.streak} dia${store.streak === 1 ? '' : 's'}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (typeof navigator.share === 'function') {
    await navigator.share({
      title: 'Water Notes',
      text,
      url: window.location.origin,
    })
    return 'shared'
  }

  await navigator.clipboard.writeText(text)
  return 'copied'
}

export function canShare(): boolean {
  return typeof navigator.share === 'function' || Boolean(navigator.clipboard)
}
