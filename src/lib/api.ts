import { auth } from "./firebase"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) throw new ApiError('You are not signed in', 401)

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
  const base = baseUrl()
  let response: Response

  try {
    response = await fetch(`${base}/${path}`, {
      ...init,
      headers: { ...(await authHeaders()), ...init.headers },
    })
  } catch {
    throw new ApiError(`Could not reach the service at ${base}`)
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

function baseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) {
    throw new ApiError(
      'Missing VITE_API_BASE_URL. Copy .env.example to .env.local and restart dev server.'
    )
  }
  return base
}

export type Envelope<T> = {
  type: string
  key: string
  name: string
  document: string
  data: T
}

export type Resource = 'races' | 'classes' | 'backgrounds' | 'equipment' | 'spells' | 'skills'

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function getCollection<T>(resource: Resource): Promise<Envelope<T>[]> {
  const base = baseUrl()
  let response: Response

  try {
    response = await fetch(`${base}/${resource}`)
  } catch {
    throw new ApiError(`Could not reach the content service at ${base}`)
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

/** The reference types /search indexes. Singular - the service answers 400 on a plural */
export type RefType =
  | 'race'
  | 'class'
  | 'background'
  | 'equipment'
  | 'spell'
  | 'skill'
  | 'monster'
  | 'magic_item'
  | 'condition'

export const SEARCH_PG_SIZE = 100

/** One page of /search. The service treats a missing content_filter as every type, so
 * an absent `type` is sent as an absent parameter rather than its "N/A" sentinel. */
export async function searchRef<T = unknown>(
  query: string,
  options: { page?: number; type?: RefType } = {},
): Promise<Envelope<T>[]> {
  const base = baseUrl()
  const params = new URLSearchParams({ q: query })
  if (options.page !== undefined && options.page > 1) params.set('page', String(options.page))
  if (options.type !== undefined) params.set('content_filter', options.type)

  let response: Response

  try {
    response = await fetch(`${base}/search?${params.toString()}`)
  } catch {
    throw new ApiError(`Could not reach the content service at ${base}`)
  }

  if (response.status === 400) {
    throw new ApiError(`The content service does not recognize the type "${options.type}".`, 400)
  }
  if (response.status === 422) {
    throw new ApiError('That search needs a term and a page of 1 or more', 422)
  }
  if (!response.ok) {
    throw new ApiError(
      `The content service returned ${response.status} for /search`,
      response.status
    )
  }

  const body: unknown = await response.json()

  if (!Array.isArray(body)) {
    throw new ApiError('Search did not return a list.')
  }

  return body as Envelope<T>[]
}

/** Walks pages until one comes back short. The service currently paginates twice, so page 2
 * answers 200 [] and this stops at one page -- correct either way once that is fixed. */
export async function searchAllRef<T = unknown>(
  query: string,
  maxPages = 10,
): Promise<Envelope<T>[]> {
  const all: Envelope<T>[] = []

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await searchRef<T>(query, { page })
    all.push(...batch)
    if(batch.length < SEARCH_PG_SIZE) break
  }

  return all
}