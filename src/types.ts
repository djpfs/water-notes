export interface Profile {
  nickname: string
  weightKg: number
  avatarId: string
  onboarded: boolean
  /** null = peso × 35 */
  goalOverrideMl: number | null
  bedtimeHour: number
  bedtimeMinute: number
  email: string | null
  photoUrl: string | null
}

export interface Cup {
  id: string
  label: string
  ml: number
}

export interface WaterEntry {
  id: string
  ml: number
  at: string
}

export type ThemeMode = 'system' | 'light' | 'dark'

export interface NotificationSettings {
  enabled: boolean
  intervalMinutes: number
  /** Início da janela de lembretes (hora local) */
  windowStartHour: number
  windowStartMinute: number
  /** Fim da janela de lembretes (hora local) */
  windowEndHour: number
  windowEndMinute: number
  /** Não notificar se a meta do dia já foi batida */
  pauseWhenGoalReached: boolean
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: false,
  intervalMinutes: 60,
  windowStartHour: 8,
  windowStartMinute: 0,
  windowEndHour: 22,
  windowEndMinute: 0,
  pauseWhenGoalReached: true,
}

export interface DayStat {
  date: string
  consumedMl: number
  goalMl: number
  reached: boolean
}

export interface AppBackup {
  version: 1
  exportedAt: string
  profile: Profile
  cups: Cup[]
  entries: WaterEntry[]
  theme: ThemeMode
  notifications: NotificationSettings
  celebratedDate: string | null
  installDismissedAt: string | null
  lastActiveDate: string | null
  lastSummaryDate: string | null
}

export const ML_PER_KG = 35
export const BACKUP_VERSION = 1 as const

export const DEFAULT_CUPS: Cup[] = [
  { id: 'cup-150', label: 'Dose', ml: 150 },
  { id: 'cup-250', label: 'Copo', ml: 250 },
  { id: 'cup-350', label: 'Caneca', ml: 350 },
  { id: 'cup-500', label: 'Garrafa', ml: 500 },
]

export const NOTIFICATION_INTERVALS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hora' },
  { minutes: 90, label: '1h 30' },
  { minutes: 120, label: '2 horas' },
  { minutes: 180, label: '3 horas' },
] as const

export const AVATARS = [
  { id: 'drop', label: 'Gota' },
  { id: 'wave', label: 'Onda' },
  { id: 'bottle', label: 'Garrafa' },
  { id: 'leaf', label: 'Folha' },
  { id: 'sun', label: 'Sol' },
  { id: 'fish', label: 'Peixe' },
  { id: 'cloud', label: 'Nuvem' },
  { id: 'shell', label: 'Concha' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']
