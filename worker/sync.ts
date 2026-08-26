import type { Context } from 'hono'
import { getSessionUser } from './auth'
import { badRequest, json, readJson, unauthorized } from './http'
import type { Env, SyncPayload } from './types'

type AppEnv = { Bindings: Env }

export async function getSync(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  const row = await c.env.DB.prepare(
    `SELECT payload, updated_at, revision FROM user_data WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<{ payload: string; updated_at: string; revision: number }>()

  if (!row) {
    return json({ data: null, revision: 0, updatedAt: null })
  }

  return json({
    data: JSON.parse(row.payload) as SyncPayload,
    revision: row.revision,
    updatedAt: row.updated_at,
  })
}

export async function putSync(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()

  const body = await readJson<{ data: SyncPayload; revision?: number }>(c.req.raw)
  if (!body?.data) return badRequest('Payload inválido')

  const existing = await c.env.DB.prepare(
    `SELECT revision FROM user_data WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<{ revision: number }>()

  const nextRevision = (existing?.revision ?? 0) + 1
  const now = new Date().toISOString()
  const payload = JSON.stringify(body.data)

  await c.env.DB.prepare(
    `INSERT INTO user_data (user_id, payload, updated_at, revision)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at,
       revision = excluded.revision`,
  )
    .bind(user.id, payload, now, nextRevision)
    .run()

  return json({ ok: true, revision: nextRevision, updatedAt: now })
}
