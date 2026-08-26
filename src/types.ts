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

export const ML_PER_KG = 35

export const DEFAULT_CUPS: Cup[] = [
  { id: 'cup-150', label: 'Shot', ml: 150 },
  { id: 'cup-250', label: 'Copo', ml: 250 },
  { id: 'cup-350', label: 'Caneca', ml: 350 },
  { id: 'cup-500', label: 'Garrafa', ml: 500 },
]

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
