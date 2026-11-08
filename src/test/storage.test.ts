import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft, type Character } from "../characters/character";
import { characterStore } from "../characters/storage";
import { pick } from "./fixtures";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

vi.mock('../lib/api', () => ({ authed: api }))

const named = (over: Partial<Character> = {}): Character => ({
  ...createDraft(),
  name: 'Vex',
  ...over,
})

/** A stored record, the way the service hands it back -- deliberately loose, because the whole
 * point of `fromResponse` is to read records written by older versions of this app. */
const stored = (over: Record<string, unknown>) =>
  [{ id: 'c-1', name: 'Vex', ...over }] as unknown as Character[]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saving a character (US-19)', () => {
  it('sends the record fields and nothing the sheet derives', async () => {
    api.post.mockResolvedValue(named())

    await characterStore.create(named({ classId: 'srd-2024_fighter', walletCp: 1500 }))

    expect(api.post).toHaveBeenCalledTimes(1)
    const [path, payload] = api.post.mock.calls[0] as [string, Record<string, unknown>]

    expect(path).toBe('characters')
    expect(Object.keys(payload).sort()).toEqual([
      'abilities',
      'backgroundId',
      'classId',
      'completedSteps',
      'equipmentChoice',
      'expertiseIds',
      'fightingStyleId',
      'id',
      'level',
      'name',
      'proficientSkillIds',
      'purchasedItemIds',
      'raceId',
      'sizeChoice',
      'spellIds',
      'toolChoiceId',
      'walletCp',
    ])
  })

  it('leaves the timestamps to the service rather than sending stale ones', async () => {
    api.post.mockResolvedValue(named())

    await characterStore.create(named())
    const [, payload] = api.post.mock.calls[0] as [string, Record<string, unknown>]

    expect(payload).not.toHaveProperty('createdAt')
    expect(payload).not.toHaveProperty('updatedAt')
  })

  it('refuses a nameless character before any request goes out', async () => {
    await expect(characterStore.create(named({ name: '   ' }))).rejects.toThrow(/needs a name/)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('refuses to rename an existing character to nothing', async () => {
    await expect(characterStore.update(named({ name: '' }))).rejects.toThrow(/needs a name/)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('reports an empty create response instead of returning undefined', async () => {
    api.post.mockResolvedValue(null)

    await expect(characterStore.create(named())).rejects.toThrow(/did not return the created/)
  })

  it('reports an empty update response instead of returning undefined', async () => {
    api.put.mockResolvedValue(null)

    await expect(characterStore.update(named())).rejects.toThrow(/did not return the updated/)
  })

  it('puts an update at the path of that one character', async () => {
    const character = named({ id: 'c-7' })
    api.put.mockResolvedValue(character)

    await characterStore.update(character)

    expect(api.put.mock.calls[0][0]).toBe('characters/c-7')
  })

  it('deletes by id', async () => {
    api.del.mockResolvedValue(null)

    await characterStore.remove('c-9')

    expect(api.del).toHaveBeenCalledWith('characters/c-9')
  })
})

describe('reading a stored character back (US-19)', () => {
  it('reads an empty roster when the service returns no body', async () => {
    api.get.mockResolvedValue(null)

    await expect(characterStore.list()).resolves.toEqual([])
  })

  it('fills in fields a record written by an older version never had', async () => {
    api.get.mockResolvedValue(stored({ abilities: { method: 'pointbuy' } }))

    const [character] = await characterStore.list()

    expect(character.level).toBe(1)
    expect(character.expertiseIds).toEqual([])
    expect(character.spellIds).toEqual([])
    expect(character.completedSteps).toEqual([])
  })

  it('keeps the stored ability scores while filling the rest of the block', async () => {
    api.get.mockResolvedValue(stored({ abilities: { method: 'pointbuy', base: { STR: 15 } } }))

    const [character] = await characterStore.list()

    expect(character.abilities.method).toBe('pointbuy')
    expect(character.abilities.base).toEqual({ STR: 15 })
    expect(character.abilities.rolled).toEqual([])
    expect(character.abilities.originBonuses).toEqual({})
  })
})

describe('the equipment migration', () => {
  it('resets a pick stored as a bare option letter and asks the step again', async () => {
    api.get.mockResolvedValue(
      stored({
        equipmentChoice: { class: 'A', background: null },
        purchasedItemIds: ['srd-2024_rope'],
        walletCp: 900,
        completedSteps: ['race', 'equipment', 'spells'],
      }),
    )

    const [character] = await characterStore.list()

    expect(character.equipmentChoice).toEqual({ class: null, background: null })
    expect(character.purchasedItemIds).toEqual([])
    expect(character.walletCp).toBe(0)
    expect(character.completedSteps).toEqual(['race', 'spells'])
  })

  it('resets on a letter stored for the background alone', async () => {
    api.get.mockResolvedValue(
      stored({ equipmentChoice: { class: null, background: 'B' }, completedSteps: ['equipment'] }),
    )

    const [character] = await characterStore.list()

    expect(character.equipmentChoice).toEqual({ class: null, background: null })
    expect(character.completedSteps).toEqual([])
  })

  it('keeps a modern pick and the purchases made from it', async () => {
    const chosen = pick('a', 1500)
    api.get.mockResolvedValue(
      stored({
        equipmentChoice: { class: chosen, background: null },
        purchasedItemIds: ['srd-2024_rope'],
        walletCp: 400,
        completedSteps: ['equipment'],
      }),
    )

    const [character] = await characterStore.list()

    expect(character.equipmentChoice.class).toEqual(chosen)
    expect(character.purchasedItemIds).toEqual(['srd-2024_rope'])
    expect(character.walletCp).toBe(400)
    expect(character.completedSteps).toEqual(['equipment'])
  })

  it('derives the wallet from both picks when the record stored none', async () => {
    api.get.mockResolvedValue(
      stored({ equipmentChoice: { class: pick('a', 1500), background: pick('b', 500) } }),
    )

    const [character] = await characterStore.list()

    expect(character.walletCp).toBe(2000)
  })

  it('keeps a spent-out wallet of zero rather than deriving over it', async () => {
    api.get.mockResolvedValue(
      stored({ equipmentChoice: { class: pick('a', 1500), background: null }, walletCp: 0 }),
    )

    const [character] = await characterStore.list()

    expect(character.walletCp).toBe(0)
  })

  it('treats a record with no equipment block as an unanswered step', async () => {
    api.get.mockResolvedValue(stored({}))

    const [character] = await characterStore.list()

    expect(character.equipmentChoice).toEqual({ class: null, background: null })
    expect(character.walletCp).toBe(0)
    expect(character.purchasedItemIds).toEqual([])
  })
})
