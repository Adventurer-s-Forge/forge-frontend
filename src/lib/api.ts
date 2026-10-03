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