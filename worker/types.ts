export type Env = {
  DB: D1Database
  ASSETS: Fetcher
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  AUTH_SECRET: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}

export type SyncPayload = {
  profile: unknown
  cups: unknown
  entries: unknown
  theme: unknown
  notifications: unknown
  feedback?: unknown
  locale?: unknown
  celebratedDate: string | null
  installDismissedAt: string | null
  lastActiveDate: string | null
  lastSummaryDate: string | null
  dailyGoalSnapshots?: Record<string, number>
}

export type UserRow = {
  id: string
  email: string
  name: string | null
  picture: string | null
  google_id: string
}
