export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function badRequest(message: string) {
  return json({ error: message }, { status: 400 })
}

export function unauthorized(message = 'Não autenticado') {
  return json({ error: message }, { status: 401 })
}

export function serverError(message = 'Erro interno') {
  return json({ error: message }, { status: 500 })
}

export function redirect(location: string, headers?: HeadersInit) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...headers },
  })
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
