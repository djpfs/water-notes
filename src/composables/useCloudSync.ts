import type { AppBackup, Cup, Profile, WaterEntry } from '@/types'
import { useAppStore } from '@/stores/app'

export type AuthUser = {
  id: string
  email: string
  name: string | null
  picture: string | null
}

export type SyncData = Pick<
  AppBackup,
  | 'profile'
  | 'cups'
  | 'entries'
  | 'theme'
  | 'notifications'
  | 'feedback'
  | 'celebratedDate'
  | 'installDismissedAt'
  | 'lastActiveDate'
  | 'lastSummaryDate'
  | 'dailyGoalSnapshots'
  | 'locale'
>

let cachedUser: AuthUser | null | undefined
let cachedAt = 0
const CACHE_MS = 30_000

let pushTimer: ReturnType<typeof setTimeout> | undefined
let pullInProgress = false
const PUSH_DEBOUNCE_MS = 500
let syncRevision = 0
let conflictRecoveryInProgress = false

class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as
      | { error?: string; code?: string; currentRevision?: number }
      | null
    throw new ApiError(err?.error || `HTTP ${res.status}`, res.status, err)
  }
  return res.json() as Promise<T>
}

export function clearAuthCache() {
  cachedUser = undefined
  cachedAt = 0
  syncRevision = 0
}

export async function fetchMe(force = false): Promise<AuthUser | null> {
  if (
    !force &&
    cachedUser !== undefined &&
    Date.now() - cachedAt < CACHE_MS
  ) {
    return cachedUser
  }
  try {
    cachedUser = await api<AuthUser>('/api/auth/me')
  } catch {
    cachedUser = null
  }
  cachedAt = Date.now()
  return cachedUser
}

export async function logoutRemote() {
  await api('/api/auth/logout', { method: 'POST' })
  clearAuthCache()
}

export async function deleteAccountRemote() {
  await api('/api/auth/account', { method: 'DELETE' })
  clearAuthCache()
}

export function startGoogleLogin() {
  window.location.href = '/api/auth/google'
}

function snapshotFromStore(): SyncData {
  const store = useAppStore()
  return {
    profile: { ...store.profile },
    cups: store.cups.map((c) => ({ ...c })),
    entries: store.entries.map((e) => ({ ...e })),
    theme: store.theme,
    notifications: { ...store.notifications },
    feedback: { ...store.feedback },
    celebratedDate: store.celebratedDate,
    installDismissedAt: store.installDismissedAt,
    lastActiveDate: store.lastActiveDate,
    lastSummaryDate: store.lastSummaryDate,
    dailyGoalSnapshots: { ...store.dailyGoalSnapshots },
    locale: store.locale,
  }
}

function mergeEntries(local: WaterEntry[], remote: WaterEntry[]): WaterEntry[] {
  const map = new Map<string, WaterEntry>()
  for (const e of local) map.set(e.id, e)
  for (const e of remote) map.set(e.id, e)
  return [...map.values()]
}

function mergeCups(local: Cup[], remote: Cup[]): Cup[] {
  const map = new Map<string, Cup>()
  for (const c of local) map.set(c.id, c)
  for (const c of remote) map.set(c.id, c)
  return [...map.values()]
}

function mergeSnapshots(
  local: Record<string, number>,
  remote: Record<string, number>,
): Record<string, number> {
  return { ...local, ...remote }
}

function isRevisionConflictError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    (err.data as { code?: string } | null)?.code === 'REVISION_CONFLICT'
  )
}

type RemoteSyncResponse = {
  data: SyncData | null
  revision: number
  updatedAt: string | null
}

async function fetchRemoteSync(): Promise<RemoteSyncResponse> {
  const remote = await api<RemoteSyncResponse>('/api/sync')
  syncRevision = remote.revision
  return remote
}

function mergeRemoteIntoStore(remote: RemoteSyncResponse): 'empty' | 'merged' | 'pulled' {
  const store = useAppStore()
  if (!remote.data) {
    return 'empty'
  }

  const localEmpty = store.entries.length === 0 && !store.profile.onboarded
  if (localEmpty) {
    store.importBackup({
      version: 1,
      exportedAt: remote.updatedAt || new Date().toISOString(),
      ...remote.data,
      profile: {
        ...(remote.data.profile as Profile),
        onboarded: true,
      },
    })
    return 'pulled'
  }

  const remoteProfile = remote.data.profile as Profile
  const remoteSnapshots =
    (remote.data.dailyGoalSnapshots as Record<string, number> | undefined) ?? {}
  const mergedEntries = mergeEntries(
    store.entries,
    remote.data.entries as WaterEntry[],
  )
  const mergedCups = mergeCups(store.cups, remote.data.cups as Cup[])

  store.importBackup({
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      ...remoteProfile,
      ...store.profile,
      photoUrl: store.profile.photoUrl || remoteProfile.photoUrl,
      email: store.profile.email || remoteProfile.email,
      onboarded: true,
    },
    cups: mergedCups.length ? mergedCups : store.cups,
    entries: mergedEntries,
    theme: store.theme,
    notifications: store.notifications,
    feedback: store.feedback,
    locale: store.locale,
    celebratedDate: store.celebratedDate || remote.data.celebratedDate,
    installDismissedAt:
      store.installDismissedAt || remote.data.installDismissedAt,
    lastActiveDate: store.lastActiveDate || remote.data.lastActiveDate,
    lastSummaryDate: store.lastSummaryDate || remote.data.lastSummaryDate,
    dailyGoalSnapshots: mergeSnapshots(
      store.dailyGoalSnapshots,
      remoteSnapshots,
    ),
  })

  return 'merged'
}

export function scheduleCloudPush() {
  if (pullInProgress) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void flushCloudPush()
  }, PUSH_DEBOUNCE_MS)
}

export async function flushCloudPush(): Promise<void> {
  clearTimeout(pushTimer)
  pushTimer = undefined
  if (pullInProgress) return
  try {
    const user = await fetchMe()
    if (user) await pushLocal()
  } catch {
    /* offline or session expired */
  }
}

export async function pullAndMerge(): Promise<'empty' | 'merged' | 'pulled'> {
  clearTimeout(pushTimer)
  pushTimer = undefined
  try {
    const user = await fetchMe()
    if (user) await pushLocalRaw()
  } catch {
    /* push before pull is best-effort */
  }

  pullInProgress = true
  try {
    return await pullAndMergeInner()
  } finally {
    pullInProgress = false
  }
}

async function pullAndMergeInner(): Promise<'empty' | 'merged' | 'pulled'> {
  const remote = await fetchRemoteSync()
  const mergeResult = mergeRemoteIntoStore(remote)
  if (mergeResult === 'empty') {
    await pushLocalRaw()
    return 'empty'
  }
  if (mergeResult === 'pulled') {
    return 'pulled'
  }

  await pushLocalRaw()
  return 'merged'
}

async function recoverFromConflict() {
  const remote = await fetchRemoteSync()
  if (remote.data) {
    mergeRemoteIntoStore(remote)
  }
}

async function pushLocalRaw() {
  const data = snapshotFromStore()
  const result = await api<{ ok: true; revision: number; updatedAt: string }>(
    '/api/sync',
    {
      method: 'PUT',
      body: JSON.stringify({ data, revision: syncRevision }),
    },
  )
  syncRevision = result.revision
}

export async function pushLocal() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await pushLocalRaw()
      return
    } catch (err) {
      if (
        !isRevisionConflictError(err) ||
        attempt === 2 ||
        pullInProgress ||
        conflictRecoveryInProgress
      ) {
        throw err
      }
      conflictRecoveryInProgress = true
      try {
        await recoverFromConflict()
      } finally {
        conflictRecoveryInProgress = false
      }
    }
  }
}
