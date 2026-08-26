export type Env = {
  DB: D1Database
  ASSETS: Fetcher
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  AUTH_SECRET: string
}

export type SyncPayload = {
  profile: unknown
  cups: unknown
  entries: unknown
  theme: unknown
  notifications: unknown
  celebratedDate: string | null
  installDismissedAt: string | null
  lastActiveDate: string | null
  lastSummaryDate: string | null
}

export type UserRow = {
  id: string
  email: string
  name: string | null
  picture: string | null
  google_id: string
}
