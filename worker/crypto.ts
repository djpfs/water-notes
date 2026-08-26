function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomId(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return bytesToHex(arr.buffer)
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signValue(secret: string, value: string): Promise<string> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return `${value}.${bytesToHex(sig)}`
}

export async function verifySignedValue(
  secret: string,
  signed: string,
): Promise<string | null> {
  const idx = signed.lastIndexOf('.')
  if (idx <= 0) return null
  const value = signed.slice(0, idx)
  const expected = await signValue(secret, value)
  if (expected !== signed) return null
  return value
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...rest] = part.trim().split('=')
      return [k, decodeURIComponent(rest.join('=') || '')]
    }),
  )
}

export function sessionCookie(
  sessionId: string,
  maxAgeSec: number,
  secure = true,
): string {
  return [
    `wn_session=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function clearSessionCookie(secure = true): string {
  return [
    'wn_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}
