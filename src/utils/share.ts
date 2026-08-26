import { useAppStore } from '@/stores/app'
import { formatDayLabel, formatVolume, localDateKey } from '@/utils/date'
import { renderShareCard } from '@/utils/shareCard'

export type ShareResult = 'shared' | 'downloaded' | 'copied'

function shareCaption(store: ReturnType<typeof useAppStore>): string {
  const pct = Math.round(store.progress * 100)
  return [
    `💧 ${formatVolume(store.todayConsumedMl)} hoje (${pct}%)`,
    store.goalReached ? 'Meta batida!' : null,
    store.streak > 0
      ? `🔥 ${store.streak} dia${store.streak === 1 ? '' : 's'} seguidos`
      : null,
    'Water Notes',
  ]
    .filter(Boolean)
    .join(' · ')
}

async function buildShareFile(store: ReturnType<typeof useAppStore>): Promise<File> {
  const blob = await renderShareCard({
    nickname: store.profile.nickname,
    photoUrl:
      store.profile.useProfilePhoto && store.profile.photoUrl
        ? store.profile.photoUrl
        : null,
    dateLabel: formatDayLabel(localDateKey()),
    consumedMl: store.todayConsumedMl,
    goalMl: store.dailyGoalMl,
    progress: store.progress,
    streak: store.streak,
    goalReached: store.goalReached,
    entries: store.todayEntries.map((e) => ({ ml: e.ml, at: e.at })),
  })

  const date = new Date().toISOString().slice(0, 10)
  return new File([blob], `water-notes-${date}.png`, { type: 'image/png' })
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

export async function shareDailyProgress(): Promise<ShareResult> {
  const store = useAppStore()
  const file = await buildShareFile(store)
  const text = shareCaption(store)

  if (typeof navigator.share === 'function') {
    const payload: ShareData = { title: 'Water Notes', text }

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ ...payload, files: [file] })
      return 'shared'
    }

    try {
      await navigator.share(payload)
      downloadFile(file)
      return 'downloaded'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  downloadFile(file)
  return 'downloaded'
}

export function canShare(): boolean {
  return (
    typeof document !== 'undefined' &&
    Boolean(document.createElement('canvas').getContext('2d'))
  )
}
