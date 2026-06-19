const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// Monotonic counter so a request log line and its matching response/error line
// can be correlated even when calls overlap.
let requestSeq = 0

const previewBody = (body: unknown): unknown => {
  if (body == null) return undefined
  if (typeof body === 'string') {
    return body.length > 500 ? `${body.slice(0, 500)}… (${body.length} chars)` : body
  }
  // FormData / Blob / File etc. aren't useful to dump — just note the type.
  if (typeof body === 'object' && !(Array.isArray(body)) && body.constructor && body.constructor !== Object) {
    return `[${body.constructor.name}]`
  }
  return body
}

async function request(method: HttpMethod, path: string, body?: unknown, init?: RequestInit): Promise<Response> {
  const id = ++requestSeq
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`

  // Serialize plain-object/array bodies to JSON and set the header unless the
  // caller passed their own headers/body via `init`.
  const headers = new Headers(init?.headers)
  let payload: BodyInit | undefined = init?.body as BodyInit | undefined
  if (body !== undefined && payload === undefined) {
    if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
      payload = body as BodyInit
    } else {
      payload = JSON.stringify(body)
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    }
  }

  console.log(`[api] #${id} → ${method} ${url}`, previewBody(body) ?? '')

  const start = performance.now()
  try {
    const resp = await fetch(url, { ...init, method, headers, body: payload })
    const ms = Math.round(performance.now() - start)
    const level = resp.ok ? 'log' : 'warn'
    console[level](`[api] #${id} ← ${resp.status} ${resp.statusText} ${method} ${url} (${ms}ms)`)
    return resp
  } catch (err) {
    const ms = Math.round(performance.now() - start)
    console.error(`[api] #${id} ✗ ${method} ${url} failed after ${ms}ms`, err)
    throw err
  }
}

export const api = {
  get: (path: string, init?: RequestInit) => request('GET', path, undefined, init),
  post: (path: string, body?: unknown, init?: RequestInit) => request('POST', path, body, init),
  put: (path: string, body?: unknown, init?: RequestInit) => request('PUT', path, body, init),
  del: (path: string, body?: unknown, init?: RequestInit) => request('DELETE', path, body, init),
  patch: (path: string, body?: unknown, init?: RequestInit) => request('PATCH', path, body, init),
}

export { API_BASE }
