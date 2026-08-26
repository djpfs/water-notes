export interface Profile {
  nickname: string
  weightKg: number
  avatarId: string
  onboarded: boolean
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
}

export const ML_PER_KG = 35

export const DEFAULT_CUPS: Cup[] = [
  { id: 'cup-150', label: 'Shot', ml: 150 },
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
