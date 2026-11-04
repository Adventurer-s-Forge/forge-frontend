import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, searchAllRef, searchRef } from "../lib/api";
import { countsByKind, hitsOfKind, toSearchHit, toSearchHits } from "../data/searchResults";
import type { Envelope } from "../lib/api";
import { seedTestCatalog } from "./fixtures";

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))

const BASE = 'http://content.test'

/** Answers each call with the next page, and hands back the URLs that were asked for. */
function stubFetch(pages: unknown[]) {
  const calls: string[] = []
  let index = 0

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url)
      const body = pages[Math.min(index, pages.length - 1)]
      index += 1
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
    }),
  )

  return calls
}

function stubStatus(status: number) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status }))))
}

const envelope = (type: string, key: string, name: string, data: unknown): Envelope<unknown> => ({
  type,
  key,
  name,
  document: 'srd-2024',
  data,
})

beforeAll(seedTestCatalog)

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubEnv('VITE_API_BASE_URL', BASE)
})

describe('searchRef', () => {
  it('leaves content_filter off when no type is asked for', async () => {
    const calls = stubFetch([[]])

    await searchRef('longsword')

    expect(calls[0]).toBe(`${BASE}/search?q=longsword`)
    expect(calls[0]).not.toContain('content_filter')
  })

  it('sends the singular type the service expects', async () => {
    const calls = stubFetch([[]])

    await searchRef('fireball', { type: 'spell' })

    expect(calls[0]).toContain('content_filter=spell')
  })

  it('omits page 1 and sends any later page', async () => {
    const calls = stubFetch([[], []])

    await searchRef('rope', { page: 1 })
    await searchRef('rope', { page: 3 })

    expect(calls[0]).not.toContain('page=')
    expect(calls[1]).toContain('page=3')
  })

  it('turns a rejected filter into something a player can read', async () => {
    stubStatus(400)

    await expect(searchRef('x', { type: 'spell' })).rejects.toThrow(
      /does not recognize the type "spell"/,
    )
  })

  it('turns a rejected query into something a player can read', async () => {
    stubStatus(422)

    await expect(searchRef('')).rejects.toMatchObject({
      message: expect.stringContaining('needs a term'),
      status: 422,
    })
  })

  it('reports an unreachable service rather than a bare network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

    await expect(searchRef('rope')).rejects.toBeInstanceOf(ApiError)
  })

  it('refuses a body that is not a list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }))),
    )

    await expect(searchRef('rope')).rejects.toThrow(/did not return a list/)
  })
})

describe('searchAllRef', () => {
  it('stops asking once a page comes back short', async () => {
    const calls = stubFetch([[envelope('spell', 'a', 'Acid Splash', {})]])

    const records = await searchAllRef('acid')

    expect(records).toHaveLength(1)
    expect(calls).toHaveLength(1)
  })

  it('keeps walking while every page is full', async () => {
    const full = Array.from({ length: 100 }, (_, i) => envelope('spell', `s${i}`, `Spell ${i}`, {}))
    const calls = stubFetch([full, [envelope('spell', 'last', 'Last', {})]])

    const records = await searchAllRef('a')

    expect(records).toHaveLength(101)
    expect(calls).toHaveLength(2)
  })
})

describe('search result mapping', () => {
  it('turns an equipment record into something the detail view can render', () => {
    const hit = toSearchHit(
      envelope('equipment', 'srd-2024_longsword', 'Longsword', {
        category: { key: 'weapon', name: 'Weapon' },
        desc: 'A versatile blade.',
        weapon: { damage_dice: '1d8' },
        cost: '15 gp',
        armor: null,
      }),
    )

    expect(hit.kind).toBe('equipment')
    expect(hit.kind === 'equipment' && hit.value.category).toBe('weapon')
    expect(hit.document).toBe('srd-2024')
  })

  it('reads the ability off the record', () => {
    const hit = toSearchHit(envelope('skill', 'stealth', 'Stealth', { ability: 'dex' }))

    expect(hit.kind).toBe('skill')
    expect(hit.kind === 'skill' && hit.value.ability).toBe('DEX')
  })

  it('files a type the Forge has no view for under other', () => {
    const hit = toSearchHit(envelope('magic_item', 'bag-of-holding', 'Bag of Holding', {}))

    expect(hit.kind).toBe('other')
    expect(hit.type).toBe('magic_item')
    expect(hit.name).toBe('Bag of Holding')
  })

  it('files a subclass under other, the way the catalog ignores them', () => {
    const hit = toSearchHit(
      envelope('class', 'srd-2024_champion', 'Champion', {
        subclass_of: { name: 'Fighter', key: 'srd-2024_fighter' },
      }),
    )

    expect(hit.kind).toBe('other')
  })

  it('reads a base class, whose subclass_of is null', () => {
    const hit = toSearchHit(
      envelope('class', 'srd-2024_fighter', 'Fighter', {
        subclass_of: null,
        hit_dice: 'd10',
        saving_throws: [{ name: 'strength' }, { name: 'constitution' }],
        caster_type: null,
        features: [],
      }),
    )

    expect(hit.kind).toBe('class')
    expect(hit.kind === 'class' && hit.value.hitDie).toBe(10)
    expect(hit.kind === 'class' && hit.value.savingThrows).toEqual(['STR', 'CON'])
  })

  it('degrades a malformed record instead of throwing', () => {
    // toRace reads data.traits, which a truncated record does not have.
    const hit = toSearchHit(envelope('race', 'srd-2024_elf', 'Elf', {}))

    expect(hit.kind).toBe('other')
    expect(hit.name).toBe('Elf')
  })

  it('keeps the rest of a mixed page when one record is unreadable', () => {
    const hits = toSearchHits([
      envelope('race', 'broken', 'Broken Race', {}),
      envelope('skill', 'arcana', 'Arcana', { ability: 'int' }),
    ])

    expect(hits.map((hit) => hit.kind)).toEqual(['other', 'skill'])
  })

  it('gives each row an id that survives a key repeated across types', () => {
    const hits = toSearchHits([
      envelope('skill', 'stealth', 'Stealth', { ability: 'dex' }),
      envelope('condition', 'stealth', 'Stealth', {}),
    ])

    expect(hits[0].id).not.toBe(hits[1].id)
  })

  it('filters and counts a mixed set by kind', () => {
    const hits = toSearchHits([
      envelope('skill', 'arcana', 'Arcana', { ability: 'int' }),
      envelope('skill', 'athletics', 'Athletics', { ability: 'str' }),
      envelope('condition', 'prone', 'Prone', {}),
    ])

    expect(hitsOfKind(hits, 'skill')).toHaveLength(2)
    expect(hitsOfKind(hits, 'all')).toHaveLength(3)
    expect(countsByKind(hits)).toEqual({ skill: 2, other: 1 })
  })
})
