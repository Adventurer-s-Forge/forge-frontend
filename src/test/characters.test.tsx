import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  POINT_BUY_MIN,
  abilityModifier,
  finalScores,
  formatModifier,
  pointBuySpent,
  roll4d6DropLowest,
} from "../characters/abilities";
import { STEPS, createDraft } from "../characters/character";
import type { Character } from "../characters/character";
import {
  completeStep,
  firstIncompleteStep,
  isComplete,
  isStepReachable,
  setAbilityMethod,
  setAbilityScore,
  setClass,
  setName,
  setRace,
  setRacialChoices,
  setRolledPool,
  toggleEquipment,
  toggleSkill,
  toggleSpell,
  isStepApplicable,
  nextStep,
} from "../characters/progress";
import { characterStore } from "../characters/storage";
import { getRace, seedCatalog } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";
import { authed } from "../lib/api";

function dice(...faces: number[]) {
  let i = 0
  return () => (faces[i++] - 0.5) / 6
}

function finishedFighter(): Character {
  let c: Character = { ...createDraft(), name: 'Arkes', backgroundId: 'srd_acolyte'}
  c = setRace(c, 'srd_half-orc')
  c = setClass(c, 'srd_fighter')
  c = {
    ...c,
    abilities: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      rolled: [],
      racialChoices: [],
    },
    proficientSkillIds: ['perception', 'survival'],
  }
  for (const { id } of STEPS) c = completeStep(c, id)
  return c
}

beforeAll(() => {
  seedCatalog({
    races: [
      { id: 'srd_half-orc', name: 'Half-Orc', size: 'Medium', speed: 30, abilityBonuses: { STR: 2, CON: 1} },
      { id: 'srd_half-elf', name: 'Half-Elf', size: 'Medium', speed: 30, abilityBonuses: { CHA: 2 }, abilityChoice: { count: 2, amount: 1, exclude: ['CHA'] } },
    ],
    classes: [
      { id: 'srd_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'],
        skillChoices: CLASS_SKILL_CHOICES.srd_fighter, casterType: 'NONE', spellCounts: { cantrips: 0, prepared: 0 } },
      { id: 'srd_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'],
        skillChoices: CLASS_SKILL_CHOICES.srd_wizard, casterType: 'FULL', spellCounts: { cantrips: 1, prepared: 1 } },
    ],
    backgrounds: [{ id: 'srd_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'], initiateClassNames: [] }],
    spells: [
      { id: 'srd_fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', classIds: ['srd_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
      { id: 'srd_shield', name: 'Shield', level: 1, school: 'Abjuration', classIds: ['srd_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
    ],
    equipment: [],
  })
})

vi.mock('../lib/api', () => ({
  authed: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
  ApiError: class extends Error {}
}))

describe('ability math', () => {
  it('derives modifiers, rounding down', () => {
    expect(abilityModifier(8)).toBe(-1)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(15)).toBe(2)
    expect(formatModifier(-1)).toBe('\u22121')
    expect(formatModifier(0)).toBe('+0')
  })

  it('prices point buy on the 27-point scale and rejects out-of-range scores', () => {
    expect(pointBuySpent({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })).toBe(0)
    expect(pointBuySpent({ STR: 15, DEX: 15, CON: 15, INT: 8, WIS: 8, CHA: 8 })).toBe(27)
    expect(pointBuySpent({ STR: 16, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })).toBe(Infinity)
  })

  it('drops the lowest of four d6', () => {
    expect(roll4d6DropLowest(dice(6, 1, 5, 3))).toBe(14)
  })

  it('applies fixed and choses racial bonuses on top of base scores', () => {
    const base = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
    expect(finalScores(base, getRace('srd_half-orc'), [])).toMatchObject({ STR: 17, CON: 14 })
    expect(finalScores(base, getRace('srd_half-elf'), ['DEX', 'CON'])).toMatchObject({ STR: 15, DEX: 15, CON: 14, CHA: 10 })
  })
})

describe('character progress', () => {
  it('starts a new draft at the name step', () => {
    expect(firstIncompleteStep(createDraft())).toBe('name')
  })

  it('resumes at the first step that was never confirmed', () => {
    const c = completeStep({ ...createDraft(), name: 'Arkes', raceId: 'srd_half-orc' }, 'name')
    expect(firstIncompleteStep(c)).toBe('race')
  })

  it('treats a fully confirmed character as complete', () => {
    expect(isComplete(finishedFighter())).toBe(true)
  })

  it('reopens skills when a class change invalidates them', () => {
    const c = setClass(finishedFighter(), 'srd_wizard')
    expect(c.proficientSkillIds).toEqual([])
    expect(firstIncompleteStep(c)).toBe('skills')
  })

  it('reopens attributes when swithcing to a race with ability choices', () => {
    expect(firstIncompleteStep(setRace(finishedFighter(), 'srd_half-elf'))).toBe('attributes')
  })
})

describe('character storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses to save a character without a name', async () => {
    await expect(characterStore.create(createDraft())).rejects.toThrow('needs a name')
    expect(authed.post).not.toHaveBeenCalled()
  })

  it('strips server-owned timestamps from the payload', async () => {
    const draft = { ...createDraft(), name: 'Arkes' }
    vi.mocked(authed.post).mockResolvedValue(draft)

    await characterStore.create(draft)

    const [path, body] = vi.mocked(authed.post).mock.calls[0]
    expect(path).toBe('characters')
    expect(body).not.toHaveProperty('createdAt')
    expect(body).not.toHaveProperty('updatedAt')
    expect(body).toMatchObject({ name: 'Arkes' })
  })

  it('returns an empty list rather than failing when the user has none', async () => {
    vi.mocked(authed.get).mockResolvedValue(null)
    expect(await characterStore.list()).toEqual([])
  })
})

describe('character mutations', () => {
  it('sets the name', () => {
    expect(setName(createDraft(), 'Nyx').name).toBe('Nyx')
  })

  it('assigns an ability score and clears it again', () => {
    const assigned = setAbilityScore(createDraft(), 'STR', 15)
    expect(assigned.abilities.base.STR).toBe(15)
    expect(setAbilityScore(assigned, 'STR', undefined).abilities.base).toEqual({})
  })

  it('seeds point buy at the minimum and empties the other methods', () => {
    const pointbuy = setAbilityMethod(createDraft(), 'pointbuy')
    expect(Object.values(pointbuy.abilities.base)).toEqual(Array(6).fill(POINT_BUY_MIN))
    expect(setAbilityMethod(pointbuy, 'standard').abilities.base).toEqual({})
  })

  it('discards the previous assignment when a new pool is rolled', () => {
    const assigned = setAbilityScore(setRolledPool(createDraft(), [15, 14, 13, 12, 10, 8]), 'STR', 15)
    const rerolled = setRolledPool(assigned, [16, 12, 11, 10, 9, 7])

    expect(rerolled.abilities.rolled).toEqual([16, 12, 11, 10, 9, 7])
    expect(rerolled.abilities.base).toEqual({})
  })

  it('caps skill selection and toggles off', () => {
    let c = toggleSkill(createDraft(), 'stealth', 2)
    c = toggleSkill(c, 'arcana', 2)
    c = toggleSkill(c, 'history', 2)

    expect(c.proficientSkillIds).toEqual(['stealth', 'arcana'])
    expect(toggleSkill(c, 'stealth', 2).proficientSkillIds).toEqual(['arcana'])
  })

  it('toggle itemss with no cap', () => {
    let c = toggleEquipment(createDraft(), 'srd_dagger')
    c = toggleEquipment(c, 'srd_rope')

    expect(c.equipmentIds).toEqual(['srd_dagger', 'srd_rope'])
    expect(toggleEquipment(c, 'srd_dagger').equipmentIds).toEqual(['srd_rope'])
  })

  it('clears racial choices when the race change affects them', () => {
    const chosen = setRacialChoices({ ...createDraft(), raceId: 'srd_half-elf' }, ['DEX', 'CON'])
    expect(setRace(chosen, 'srd_half-orc').abilities.racialChoices).toEqual([])
  })

  it('unlocks a step only once every earlier step is confirmed', () => {
    const draft = createDraft()
    expect(isStepReachable('name', draft)).toBe(true)
    expect(isStepReachable('race', draft)).toBe(false)
    expect(isStepReachable('race', completeStep(setName(draft, 'Nyx'), 'name'))).toBe(true)
  })

  it('does not re-add a step that is already confirmed', () => {
    const once = completeStep(createDraft(), 'name')
    expect(completeStep(once, 'name')).toBe(once)
  })

  it('skips the spells step for a non-caster', () => {
    const c = setClass(createDraft(), 'srd_fighter')
    expect(isStepApplicable('spells', c)).toBe(false)
  })

  it('offers the spells step to a caster', () => {
    const c = setClass(createDraft(), 'srd_wizard')
    expect(isStepApplicable('spells', c)).toBe(true)
    expect(nextStep(c, 'skills')).toBe('spells')
  })

  it('drops spells the new class cannot cast', () => {
    let c = setClass(createDraft(), 'srd_wizard')
    c = toggleSpell(c, 'srd_fire-bolt')
    expect(setClass(c, 'srd_fighter').spellIds).toEqual([])
  })

  it('deletes by id', async () => {
    await characterStore.remove('abc-123')
    expect(authed.del).toHaveBeenCalledWith('characters/abc-123')
  })
})