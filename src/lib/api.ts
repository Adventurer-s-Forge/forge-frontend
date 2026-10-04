import { auth } from "./firebase"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) throw new ApiError('You ar enot signed in', 401)

  const token = await user.getIdToken()

  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function toApiError(response:Response, path: string): Promise<ApiError> {
  if (response.status === 401) {
    return new ApiError('Your session has expired. Please sign in again', 401)
  }
  if (response.status === 404) {
    return new ApiError('That character no longer exist', 404)
  }
  if (response.status === 409) {
    return new ApiError('That character has already been saved.', 409)
  }
  if (response.status === 422) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    const detail = typeof body?.detail === 'string' ? body.detail : null
    return new ApiError(detail ?? 'The server rejected that character', 422)
  }
  return new ApiError(`Request to ${path} failed (${response.status}).`, response.status)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  let response: Response

  try {
    response = await fetch(`${BASE}/${path}`, {
      ...init,
      headers: { ...(await authHeaders()), ...init.headers },
    })
  } catch {
    throw new ApiError(`Could not reach the service at ${BASE}`)
  }

  if (response.status === 204) return null
  if (!response.ok) throw await toApiError(response, path)
  return (await response.json()) as T
}

export const authed = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request<null>(path, { method: 'DELETE' }),
}

const BASE = import.meta.env.VITE_API_BASE_URL

if (!BASE) {
  throw new Error(
    'Missing VITE_API_BASE_URL. Copy .env.example to .env.local and restart dev server'
  )
}

export type Envelope<T> = {
  type: string
  key: string
  name: string
  document: string
  data: T
}

export type Resource = 'races' | 'classes' | 'backgrounds' | 'items' | 'spells'

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function getCollection<T>(resource: Resource): Promise<Envelope<T>[]> {
  let response: Response

  try {
    response = await fetch(`${BASE}/${resource}`)
  } catch {
    throw new ApiError(`Could not reach the content service at ${BASE}`)
  }

  if (!response.ok) {
    throw new ApiError(
      `The content service returned ${response.status} for /${resource}.`,
      response.status
    )
  }

  const body: unknown = await response.json()

  if (!Array.isArray(body)) {
    throw new ApiError(`${resource} did not return a list.`)
  }

  return body as Envelope<T>[]
}