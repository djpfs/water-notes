import type { Context } from 'hono'
import {
  clearSessionCookie,
  randomId,
  sessionCookie,
  signValue,
  verifySignedValue,
} from './crypto'
import {
  SESSION_DAYS,
  createSession,
  destroySession,
  getSessionUser,
  upsertGoogleUser,
} from './auth'
import { json, redirect, unauthorized } from './http'
import type { Env } from './types'
import { parseCookies } from './crypto'

type AppEnv = { Bindings: Env }

function callbackUrl(c: Context<AppEnv>) {
  const url = new URL(c.req.url)
  return `${url.protocol}//${url.host}/api/auth/callback`
}

function isSecureRequest(c: Context<AppEnv>) {
  return new URL(c.req.url).protocol === 'https:'
}

function oauthStateCookie(state: string, secure: boolean) {
  return [
    `wn_oauth_state=${encodeURIComponent(state)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=600',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function clearOauthStateCookie(secure: boolean) {
  return [
    'wn_oauth_state=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export async function startGoogleAuth(c: Context<AppEnv>) {
  const { GOOGLE_CLIENT_ID, AUTH_SECRET } = c.env
  if (!GOOGLE_CLIENT_ID || !AUTH_SECRET) {
    return json({ error: 'Auth não configurada no Worker' }, { status: 503 })
  }

  const secure = isSecureRequest(c)
  const nonce = randomId(16)
  const state = await signValue(AUTH_SECRET, nonce)
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(c),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })

  const res = new Response(null, { status: 302 })
  res.headers.set(
    'Location',
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  )
  res.headers.append('Set-Cookie', oauthStateCookie(state, secure))
  return res
}

export async function googleCallback(c: Context<AppEnv>) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, DB } = c.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !AUTH_SECRET) {
    return redirect('/entrar?auth=error')
  }

  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookies = parseCookies(c.req.header('Cookie'))
  const stateCookie = cookies.wn_oauth_state

  if (!code || !state || !stateCookie || stateCookie !== state) {
    return redirect('/entrar?auth=error')
  }
  if (!(await verifySignedValue(AUTH_SECRET, state))) {
    return redirect('/entrar?auth=error')
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(c),
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) return redirect('/entrar?auth=error')

  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  if (!tokenJson.access_token) return redirect('/entrar?auth=error')

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  })
  if (!profileRes.ok) return redirect('/entrar?auth=error')

  const profile = (await profileRes.json()) as {
    sub: string
    email?: string
    name?: string
    picture?: string
  }

  if (!profile.sub || !profile.email) return redirect('/entrar?auth=error')

  const user = await upsertGoogleUser(DB, {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  })

  const sessionId = await createSession(DB, user.id)
  const secure = isSecureRequest(c)
  const res = new Response(null, { status: 302 })
  res.headers.set('Location', '/entrar?auth=ok')
  res.headers.append(
    'Set-Cookie',
    sessionCookie(sessionId, SESSION_DAYS * 24 * 60 * 60, secure),
  )
  res.headers.append('Set-Cookie', clearOauthStateCookie(secure))
  return res
}

export async function me(c: Context<AppEnv>) {
  const user = await getSessionUser(c.req.raw, c.env.DB)
  if (!user) return unauthorized()
  return json({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
}

export async function logout(c: Context<AppEnv>) {
  await destroySession(c.env.DB, c.req.raw)
  const res = json({ ok: true })
  res.headers.append('Set-Cookie', clearSessionCookie(isSecureRequest(c)))
  return res
}
