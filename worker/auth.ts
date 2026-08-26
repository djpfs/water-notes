import type { UserRow } from './types'
import { parseCookies, randomId } from './crypto'

const SESSION_DAYS = 30

export async function getSessionUser(
  request: Request,
  db: D1Database,
): Promise<UserRow | null> {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const sessionId = cookies.wn_session
  if (!sessionId) return null

  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.picture, u.google_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, new Date().toISOString())
    .first<UserRow>()

  return row ?? null
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = randomId(32)
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    )
    .bind(id, userId, expires.toISOString(), now.toISOString())
    .run()
  return id
}

export async function destroySession(db: D1Database, request: Request) {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const sessionId = cookies.wn_session
  if (!sessionId) return
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run()
}

export async function deleteUserAccount(db: D1Database, userId: string) {
  await db.prepare(`DELETE FROM user_data WHERE user_id = ?`).bind(userId).run()
  await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run()
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run()
}

export async function upsertGoogleUser(
  db: D1Database,
  profile: { sub: string; email: string; name?: string; picture?: string },
): Promise<UserRow> {
  const existing = await db
    .prepare(`SELECT id, email, name, picture, google_id FROM users WHERE google_id = ?`)
    .bind(profile.sub)
    .first<UserRow>()

  const now = new Date().toISOString()

  if (existing) {
    await db
      .prepare(
        `UPDATE users SET email = ?, name = ?, picture = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(profile.email, profile.name ?? null, profile.picture ?? null, now, existing.id)
      .run()
    return {
      ...existing,
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    }
  }

  const id = randomId(16)
  await db
    .prepare(
      `INSERT INTO users (id, email, name, picture, google_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      profile.email,
      profile.name ?? null,
      profile.picture ?? null,
      profile.sub,
      now,
      now,
    )
    .run()

  return {
    id,
    email: profile.email,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    google_id: profile.sub,
  }
}

export { SESSION_DAYS }
