import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, searchAllRef, searchRef } from "../lib/api";
import { hitsOfKind, toSearchHit, toSearchHits } from "../data/searchResults";
import { isBaseClass } from "../data/normalize";
import type { Envelope } from "../lib/api";
import type { RawClass } from "../data/normalize";
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

/** The body /search sends now. `total` and `counts` describe the whole match set rather
 * than this page, and `num items on page` is len(result), which the reader ignores. */
const page = (result: Envelope<unknown>[], extra: Record<string, unknown> = {}) => ({
  total: result.length,
  counts: {},
  'num items on page': result.length,
  result,
  ...extra,
})

const fill = (count: number, type: string): Envelope<unknown>[] =>
  Array.from({ length: count }, (_, i) => envelope(type, `${type}-${i}`, `${type} ${i}`, {}))

/** A subclass as the service sends one: the class-wide fields empty, its own features
 * gained above level 1, and listed alphabetically rather than in level order. */
const CHAMPION = {
  subclass_of: { name: 'Fighter', key: 'srd-2024_fighter' },
  desc: '*Pursue Physical Excellence in Combat*',
  hit_dice: null,
  saving_throws: [],
  primary_abilities: [],
  caster_type: 'NONE',
  features: [
    { name: 'Additional Fighting Style', desc: 'You gain another Fighting Style feat.', gained_at: [{ level: 7 }] },
    { name: 'Improved Critical', desc: 'Your attack rolls can score a Critical Hit on a 19 or 20.', gained_at: [{ level: 3 }] },
    { name: 'Survivor', desc: 'You gain Advantage on Death Saving Throws.', gained_at: [{ level: 18 }] },
  ],
}

const FIGHTER = {
  subclass_of: null,
  hit_dice: 'd10',
  saving_throws: [{ name: 'strength' }, { name: 'constitution' }],
  caster_type: null,
  features: [],
}

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

  it('refuses a body that is neither a list nor a page', async () => {
    stubFetch(['no results for you'])

    await expect(searchRef('rope')).rejects.toThrow(/did not return a list/)
  })

  it('reads the total, the nine per-type counts and the records off a page body', async () => {
    stubFetch([
      {
        total: 1268,
        counts: {
          race: 5, class: 14, background: 3, equipment: 136, spell: 230,
          skill: 12, monster: 231, magic_item: 630, condition: 7,
        },
        'num items on page': 2,
        result: [
          envelope('race', 'srd-2024_human', 'Human', {}),
          envelope('spell', 'srd-2024_fire-bolt', 'Fire Bolt', {}),
        ],
      },
    ])

    const found = await searchRef('a')

    expect(found.total).toBe(1268)
    expect(found.result.map((record) => record.name)).toEqual(['Human', 'Fire Bolt'])
    expect(found.counts).toEqual({
      race: 5, class: 14, background: 3, equipment: 136, spell: 230,
      skill: 12, monster: 231, magic_item: 630, condition: 7,
    })
    // Every type is carried through, so the counts still account for the whole total.
    expect(Object.values(found.counts).reduce((sum, count) => sum + count, 0)).toBe(1268)
  })

  it('zero-fills a reference type the service leaves out of counts', async () => {
    stubFetch([page([], { total: 5, counts: { spell: 5 } })])

    const found = await searchRef('fire')

    expect(found.counts.monster).toBe(0)
    expect(found.counts.background).toBe(0)
    expect(Object.keys(found.counts)).toHaveLength(9)
  })

  it('drops a count for a type the Forge has never heard of', async () => {
    stubFetch([page([], { total: 1, counts: { spell: 1, vehicle: 9 } })])

    const found = await searchRef('cart')

    expect(found.counts).not.toHaveProperty('vehicle')
    expect(found.counts.spell).toBe(1)
  })

  it('still reads the older bare list, counting the records itself', async () => {
    stubFetch([[
      envelope('spell', 'a', 'Acid Splash', {}),
      envelope('spell', 'b', 'Acid Arrow', {}),
      envelope('monster', 'c', 'Aboleth', {}),
    ]])

    const found = await searchRef('ac')

    expect(found.total).toBe(3)
    expect(found.counts.spell).toBe(2)
    expect(found.counts.monster).toBe(1)
    expect(found.capped).toBe(false)
  })

  it('never reports a total smaller than the records in hand', async () => {
    stubFetch([page([envelope('skill', 'stealth', 'Stealth', {})], { total: 0 })])

    const found = await searchRef('stealth')

    expect(found.total).toBe(1)
    expect(found.capped).toBe(false)
  })

  it('marks a page capped only when the service holds more than it sent', async () => {
    const one = [envelope('race', 'srd-2024_human', 'Human', {})]
    stubFetch([page(one, { total: 1268 }), page(one)])

    expect((await searchRef('a')).capped).toBe(true)
    expect((await searchRef('human')).capped).toBe(false)
  })
})

describe('searchAllRef', () => {
  it('stops asking once a page comes back short', async () => {
    const calls = stubFetch([[envelope('spell', 'a', 'Acid Splash', {})]])

    const found = await searchAllRef('acid')

    expect(found.result).toHaveLength(1)
    expect(calls).toHaveLength(1)
  })

  it('keeps walking while every page is full', async () => {
    const calls = stubFetch([fill(100, 'spell'), [envelope('spell', 'last', 'Last', {})]])

    const found = await searchAllRef('a')

    expect(found.result).toHaveLength(101)
    expect(calls).toHaveLength(2)
  })

  it('carries page ones global total and counts rather than summing the pages', async () => {
    const global = { total: 1268, counts: { spell: 230, monster: 231 } }
    stubFetch([
      page(fill(100, 'spell'), global),
      page([envelope('spell', 'last', 'Last', {})], global),
    ])

    const found = await searchAllRef('a')

    expect(found.result).toHaveLength(101)
    expect(found.total).toBe(1268)
    expect(found.counts.spell).toBe(230)
    expect(found.counts.monster).toBe(231)
  })

  it('reports capped when every page it read was full', async () => {
    const calls = stubFetch([page(fill(100, 'monster'), { total: 1268 })])

    const found = await searchAllRef('a', { maxPages: 3 })

    expect(calls).toHaveLength(3)
    expect(found.result).toHaveLength(300)
    expect(found.total).toBe(1268)
    expect(found.capped).toBe(true)
  })

  it('sends the content filter on every page it walks, not just the first', async () => {
    const calls = stubFetch([
      page(fill(100, 'spell'), { total: 230 }),
      page(fill(30, 'spell'), { total: 230 }),
    ])

    const found = await searchAllRef('a', { type: 'spell' })

    expect(calls).toHaveLength(2)
    expect(calls.every((url) => url.includes('content_filter=spell'))).toBe(true)
    expect(calls[1]).toContain('page=2')
    expect(found.result).toHaveLength(130)
  })

  it('reports not capped once a page comes back short, even after an exactly full one', async () => {
    const global = { total: 100, counts: { skill: 100 } }
    const calls = stubFetch([page(fill(100, 'skill'), global), page([], global)])

    const found = await searchAllRef('a')

    // 100 records in hand used to read as capped, because 100 is the page size.
    expect(calls).toHaveLength(2)
    expect(found.result).toHaveLength(100)
    expect(found.capped).toBe(false)
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

  it('reads a subclass as a subclass, naming the class it belongs to', () => {
    const hit = toSearchHit(envelope('class', 'srd-2024_champion', 'Champion', CHAMPION))

    expect(hit.kind).toBe('subclass')
    expect(hit.kind === 'subclass' && hit.value.parentName).toBe('Fighter')
    expect(hit.kind === 'subclass' && hit.value.desc).toContain('Physical Excellence')
  })

  it('orders subclass features by the level they are gained at, not the order sent', () => {
    const hit = toSearchHit(envelope('class', 'srd-2024_champion', 'Champion', CHAMPION))

    expect(hit.kind === 'subclass' && hit.value.features.map((feat) => feat.level)).toEqual([3, 7, 18])
    expect(hit.kind === 'subclass' && hit.value.features[0].name).toBe('Improved Critical')
  })

  it('names no parent rather than an undefined one', () => {
    const orphan = { ...CHAMPION, subclass_of: { key: 'srd-2024_fighter' } }
    const hit = toSearchHit(envelope('class', 'srd-2024_champion', 'Champion', orphan))

    expect(hit.kind === 'subclass' && hit.value.parentName).toBe('a class')
  })

  it('counts and filters a subclass under Classes, the way the service counts it', () => {
    const hits = toSearchHits([
      envelope('class', 'srd-2024_fighter', 'Fighter', FIGHTER),
      envelope('class', 'srd-2024_champion', 'Champion', CHAMPION),
    ])

    expect(hits.map((hit) => hit.kind)).toEqual(['class', 'subclass'])
    expect(hitsOfKind(hits, 'class')).toHaveLength(2)
  })

  it('keeps a subclass out of the catalog, so creation still cannot choose one', () => {
    const records = [
      envelope('class', 'srd-2024_fighter', 'Fighter', FIGHTER),
      envelope('class', 'srd-2024_champion', 'Champion', CHAMPION),
    ] as Envelope<RawClass>[]

    expect(records.filter(isBaseClass).map((record) => record.name)).toEqual(['Fighter'])
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

  it('filters a mixed set by kind', () => {
    const hits = toSearchHits([
      envelope('skill', 'arcana', 'Arcana', { ability: 'int' }),
      envelope('skill', 'athletics', 'Athletics', { ability: 'str' }),
      envelope('condition', 'prone', 'Prone', {}),
    ])

    expect(hitsOfKind(hits, 'skill')).toHaveLength(2)
    expect(hitsOfKind(hits, 'all')).toHaveLength(3)
    // A condition has no chip, so no filter claims it -- it shows only under Everything.
    expect(hitsOfKind(hits, 'spell')).toHaveLength(0)
  })
})
