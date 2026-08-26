import { Hono } from 'hono'
import {
  getVapidPublicKey,
  runScheduledPushReminders,
  subscribePush,
  testPush,
  unsubscribePush,
} from './push'
import { getSync, putSync } from './sync'
import { googleCallback, deleteAccount, logout, me, startGoogleAuth } from './google'
import type { Env } from './types'

type AppEnv = { Bindings: Env }

const api = new Hono<AppEnv>()

api.get('/auth/google', startGoogleAuth)
api.get('/auth/callback', googleCallback)
api.get('/auth/me', me)
api.post('/auth/logout', logout)
api.delete('/auth/account', deleteAccount)
api.get('/sync', getSync)
api.put('/sync', putSync)
api.get('/push/vapid-key', getVapidPublicKey)
api.post('/push/subscribe', subscribePush)
api.post('/push/unsubscribe', unsubscribePush)
api.post('/push/test', testPush)
api.get('/health', (c) => c.json({ ok: true }))

const app = new Hono<AppEnv>()
app.route('/api', api)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx)
    }
    return env.ASSETS.fetch(request)
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledPushReminders(env))
  },
}
