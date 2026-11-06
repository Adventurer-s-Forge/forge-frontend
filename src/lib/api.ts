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

/** The reference types /search indexes, in the order the service lists them.
 * Singular - the service answers 400 on a plural. */
export const REF_TYPES = [
  'race',
  'class',
  'background',
  'equipment',
  'spell',
  'skill',
  'monster',
  'magic_item',
  'condition'
] as const

export type RefType = (typeof REF_TYPES)[number]

/** One entry per reference type, zeros included, the way /search sends it. */
export type RefCounts = Record<RefType, number>

/** A page of /search. `total` and `counts` describe the whole match rather than this
 * slice of it, so a capped page knows how much it is hiding. */
export type SearchPage<T> = {
  total: number
  counts: RefCounts
  result: Envelope<T>[]
  capped: boolean
}

export const SEARCH_PG_SIZE = 100

export const emptyRefCounts = (): RefCounts => Object.fromEntries(REF_TYPES.map((type) => [type, 0])) as RefCounts

/** Keeps the counts the service sends and zero for the ones it leaves out. A type this app
 * has never heard of is dropped rather than widening RefCoints at runtime. */
function readCounts(value: unknown): RefCounts {
  const counts = emptyRefCounts()
  if (value === null || typeof value !== 'object') return counts

  for (const type of REF_TYPES) {
    const count = (value as Record<string, unknown>)[type]
    if (typeof count === 'number' && Number.isFinite(count)) counts[type] = count
  }

  return counts
}

function countRecords(records: Envelope<unknown>[]): RefCounts {
  const counts = emptyRefCounts()

  for (const record of records) {
    const raw = (record ?? {}) as Partial<Envelope<unknown>>
    if (typeof raw.type === 'string' && raw.type in counts) counts[raw.type as RefType] += 1
  }

  return counts
}

/** The service answer a bare list until the page shape landed, so both are read and the
 * two repos do not have to deploy together -- drop the array branch once it has.
 * `num items on page` is ignored: it is len(result), which the caller already holds. */
function toSearchPage<T>(body: unknown): SearchPage<T> {
  if (Array.isArray(body)) {
    const result = body as Envelope<T>[]
    return {
      total: result.length,
      counts: countRecords(result),
      result,
      capped: result.length === SEARCH_PG_SIZE,
    }
  }

  const page = (body ?? {}) as { total?: unknown; counts?: unknown; result?: unknown }
  
  if (!Array.isArray(page.result)) {
    throw new ApiError('Search did not return a list of results.')
  }

  const result = page.result as Envelope<T>[]
  const reported = typeof page.total === 'number' && Number.isFinite(page.total) ? page.total : 0
  const total = Math.max(reported, result.length)

  return { total, counts: readCounts(page.counts), result, capped: result.length < total }
}

/** One page of /search/ The service treats a missing content_filter as every type, so
 * an absent `type` is sent as an absent param rather than its "N/A" sentinel. */
export async function searchRef<T = unknown>(query: string, options: { page?: number; type?: RefType } = {}): Promise<SearchPage<T>> {
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
    throw new ApiError('That search needs a term and a page of 1 or mroe.', 422)
  }
  if (!response.ok) {
    throw new ApiError(`The content service returned ${response.status} for /search`, response.status)
  }

  return toSearchPage<T>(await response.json())
}

/** Walks pages until one comes back short, or `maxPages` have been read. `total` and
 * `counts` are global, so page 1;s are kept rather than summed. */
export async function searchAllRef<T = unknown>(query: string, maxPages = 10): Promise<SearchPage<T>> {
  const result: Envelope<T>[] =[]
  let first: SearchPage<T> | null = null
  let short = false
  
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await searchRef<T>(query, { page })
    first ??= batch
    result.push(...batch.result)

    short = batch.result.length < SEARCH_PG_SIZE
    if (short) break
  }

  return {
    total: Math.max(first?.total ?? 0, result.length),
    counts: first?.counts ?? emptyRefCounts(),
    result,
    capped: !short,
  }
}