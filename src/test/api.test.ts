import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authed, getCollection } from "../lib/api";

const fb = vi.hoisted(() => ({
  auth: { currentUser: null as { getIdToken: () => Promise<string> } | null },
}))

vi.mock('../lib/firebase', () => ({ auth: fb.auth, app: {} }))

const BASE = 'http://api.test'

function stub(status: number, body?: unknown) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(body ?? {}), { status }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** For a body that is not JSON at all -- the 422 reader has to survive one. */
function stubRaw(text: string, status: number) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(text, { status })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubUnreachable() {
  const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const signIn = () => {
  fb.auth.currentUser = { getIdToken: () => Promise.resolve('tok-1') }
}

const headersOf = (mock: ReturnType<typeof stub>) =>
  (mock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', BASE)
  fb.auth.currentUser = null
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('the base url', () => {
  it('names the file to copy when the environment has no service url', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    stub(200, [])

    await expect(getCollection('skills')).rejects.toThrow(/Copy .env.example to .env.local/)
  })
})

describe('getCollection (FR-10)', () => {
  it('reads a list of records', async () => {
    const records = [{ type: 'skill', key: 'stealth', name: 'Stealth', document: 'srd', data: {} }]
    const fetchMock = stub(200, records)

    await expect(getCollection('skills')).resolves.toEqual(records)
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/skills`)
  })

  it('reports the status when the service refuses the collection', async () => {
    stub(503)

    const error = await getCollection('spells').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
    expect((error as ApiError).message).toContain('503 for /spells')
  })

  it('refuses a body that is not a list rather than handing back an object', async () => {
    stub(200, { result: [] })

    await expect(getCollection('classes')).rejects.toThrow('classes did not return a list.')
  })

  it('says the service is unreachable when the request never completes', async () => {
    stubUnreachable()

    await expect(getCollection('races')).rejects.toThrow(
      `Could not reach the content service at ${BASE}`,
    )
  })
})

describe('an authenticated request (FR-3)', () => {
  it('sends the firebase token and asks for json', async () => {
    signIn()
    const fetchMock = stub(200, { id: 'c-1' })

    await authed.get('characters')

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/characters`)
    expect(headersOf(fetchMock)).toMatchObject({
      Authorization: 'Bearer tok-1',
      'Content-Type': 'application/json',
    })
  })

  it('refuses to send anything while nobody is signed in', async () => {
    const fetchMock = stub(200, {})

    const error = await authed.get('characters').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('You are not signed in')
    expect((error as ApiError).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads a delete that answers with no content as nothing', async () => {
    signIn()
    stub(204)

    await expect(authed.del('characters/c-1')).resolves.toBeNull()
  })

  it('posts the body as json', async () => {
    signIn()
    const fetchMock = stub(200, { id: 'c-1' })

    await authed.post('characters', { name: 'Vex' })

    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[0][1]?.body).toBe('{"name":"Vex"}')
  })

  it('puts the body as json', async () => {
    signIn()
    const fetchMock = stub(200, { id: 'c-1' })

    await authed.put('characters/c-1', { name: 'Vex' })

    expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT')
    expect(fetchMock.mock.calls[0][1]?.body).toBe('{"name":"Vex"}')
  })

  it('says the service is unreachable when the request never completes', async () => {
    signIn()
    stubUnreachable()

    await expect(authed.get('characters')).rejects.toThrow(
      `Could not reach the service at ${BASE}`,
    )
  })
})

describe('the messages a failed request carries', () => {
  beforeEach(signIn)

  it('asks the player to sign in again on an expired session', async () => {
    stub(401)

    await expect(authed.get('characters')).rejects.toThrow(/session has expired/)
  })

  it('says the character is gone on a 404', async () => {
    stub(404)

    await expect(authed.get('characters/c-1')).rejects.toThrow(/no longer exist/)
  })

  it('says the character was already saved on a conflict', async () => {
    stub(409)

    await expect(authed.post('characters', {})).rejects.toThrow(/already been saved/)
  })

  it('passes through the detail the service gives for a rejected character', async () => {
    stub(422, { detail: 'Level must be 1.' })

    await expect(authed.post('characters', {})).rejects.toThrow('Level must be 1.')
  })

  it('falls back to its own wording when the detail is not a string', async () => {
    stub(422, { detail: [{ msg: 'too long' }] })

    await expect(authed.post('characters', {})).rejects.toThrow('The server rejected that character')
  })

  it('falls back to its own wording when the error body is not json', async () => {
    stubRaw('<html>502 Bad Gateway</html>', 422)

    await expect(authed.post('characters', {})).rejects.toThrow('The server rejected that character')
  })

  it('names the path and the status for anything else', async () => {
    stub(500)

    const error = await authed.get('characters').catch((e: unknown) => e)

    expect((error as ApiError).message).toBe('Request to characters failed (500).')
    expect((error as ApiError).status).toBe(500)
  })
})
