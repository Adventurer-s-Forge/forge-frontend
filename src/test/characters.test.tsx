import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  POINT_BUY_MIN,
  abilityModifier,
  finalScores,
  formatModifier,
  originSpreadValid,
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
  setRolledPool,
  toggleSkill,
  toggleSpell,
  isStepApplicable,
  nextStep,
  setOriginBonuses,
  setBackground,
  buyItem,
  sellItem,
  setEquipmentChoice,
  isStepValid,
} from "../characters/progress";
import { characterStore } from "../characters/storage";
import { seedCatalog } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";
import { authed } from "../lib/api";
import { derived, ownedItemIds, purseCp } from "../components/character/sheets";

function dice(...faces: number[]) {
  let i = 0
  return () => (faces[i++] - 0.5) / 6
}

function finishedFighter(): Character {
  let c: Character = { ...createDraft(), name: 'Arkes', backgroundId: 'srd-2024_acolyte'}
  c = setRace(c, 'srd-2024_dwarf')
  c = setClass(c, 'srd-2024_fighter')
  c = setEquipmentChoice(c, 'class', 'B')
  c = {
    ...c,
    abilities: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      rolled: [],
      originBonuses: { INT: 2, WIS: 1 },
    },
    proficientSkillIds: ['perception', 'survival'],
  }
  for (const { id } of STEPS) c = completeStep(c, id)
  return c
}

beforeAll(() => {
  seedCatalog({
    races: [
      { id: 'srd-2024_human', name: 'Human', sizes: ['Medium', 'Small'], speed: 30 },
      { id: 'srd-2024_dwarf', name: 'Dwarf', sizes: ['Medium'], speed: 30 },
    ],
    classes: [
      { id: 'srd-2024_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'],
        skillChoices: CLASS_SKILL_CHOICES.fighter, casterType: 'NONE', spellCounts: { cantrips: 0, prepared: 0 }, spellSlots: 0, 
        startingEquipment: [
          { key: 'A', label: 'Chain mail, Longsword, and 5 GP',
            grants: [
              { text: 'Chain mail', quantity: 1, itemId: 'srd-2024_chain-mail', choosableFrom: null },
              { text: 'Longsword', quantity: 1, itemId: 'srd-2024_longsword', choosableFrom: null },
            ],
            goldCp: 500 },
          { key: 'B', label: '75 GP', grants: [], goldCp: 7500 },
        ] },
      { id: 'srd-2024_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'],
        skillChoices: CLASS_SKILL_CHOICES.wizard, casterType: 'FULL', spellCounts: { cantrips: 1, prepared: 1 }, spellSlots: 2,
      startingEquipment: [] },
    ],
    backgrounds: [
      { id: 'srd-2024_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'], initiateClassNames: [],
        abilityOptions: ['INT', 'WIS', 'CHA'], startingEquipment: [] },
      { id: 'srd-2024_sage', name: 'Sage', skillIds: ['arcana', 'history'], initiateClassNames: ['Wizard'],
        abilityOptions: ['CON', 'INT', 'WIS'], startingEquipment: [] },
    ],
    spells: [
      { id: 'srd-2024_fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', classIds: ['srd-2024_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
      { id: 'srd-2024_shield', name: 'Shield', level: 1, school: 'Abjuration', classIds: ['srd-2024_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
    ],
    equipment: [
      { id: 'srd-2024_longsword', name: 'Longsword', category: 'weapon', desc: 'A versatile blade.', costCp: 1500 },
      { id: 'srd-2024_chain-mail', name: 'Chain mail', category: 'armor', desc: 'Heavy interlocking rings.', costCp: 7500,
        armor: { base: 16, addDex: false, capDex: null, stealthDisadvantage: true } },
      { id: 'srd-2024_rope', name: 'Rope (50 feet)', category: 'gear', desc: 'Hempen rope.', costCp: 100 },
    ],
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

  it('adds the origin allocation on top of the base scores', () => {
    const base = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }
    expect(finalScores(base, { INT: 2, WIS: 1 })).toMatchObject({ INT: 14, WIS: 11, STR: 15 })
    expect(finalScores(base, { INT: 1, WIS: 1, CHA: 1})).toMatchObject({ INT: 13, WIS: 11, CHA: 9 })
  })

  it('accepts only the two legal 2024 spreads', () => {
    expect(originSpreadValid({ INT: 2, WIS: 1 })).toBe(true)
    expect(originSpreadValid({ INT: 1, WIS: 1, CHA: 1 })).toBe(true)
    expect(originSpreadValid({ INT: 3 })).toBe(false)
    expect(originSpreadValid({ INT: 2, WIS: 2 })).toBe(false)
    expect(originSpreadValid({ INT: 2 })).toBe(false)
    expect(originSpreadValid({})).toBe(false)
  })
})

describe('character progress', () => {
  it('starts a new draft at the name step', () => {
    expect(firstIncompleteStep(createDraft())).toBe('name')
  })

  it('resumes at the first step that was never confirmed', () => {
    const c = completeStep({ ...createDraft(), name: 'Arkes', raceId: 'srd-2024_dwarf' }, 'name')
    expect(firstIncompleteStep(c)).toBe('race')
  })

  it('treats a fully confirmed character as complete', () => {
    expect(isComplete(finishedFighter())).toBe(true)
  })

  it('reopens skills when a class change invalidates them', () => {
    const c = setClass(finishedFighter(), 'srd-2024_wizard')
    expect(c.proficientSkillIds).toEqual([])
    expect(firstIncompleteStep(c)).toBe('skills')
  })

  it('reopens attributes when the background changes', () => {
    const c = setBackground(finishedFighter(), 'srd-2024_sage')
    expect(c.abilities.originBonuses).toEqual({})
    expect(firstIncompleteStep(c)).toBe('attributes')
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

  it('buys the same item twice and sells one back', () => {
    let c = buyItem(createDraft(), 'srd-2024_longsword') 
    c = buyItem(c, 'srd-2024_longsword')
    expect(c.purchasedItemIds).toEqual(['srd-2024_longsword', 'srd-2024_longsword'])
    expect(sellItem(c, 'srd-2024_longsword').purchasedItemIds).toEqual(['srd-2024_longsword'])
  })

  it('clears the origin allocation when the background changes', () => {
    const chosen = setOriginBonuses({ ...createDraft(), backgroundId: 'srd-2024_acolyte' }, { INT: 2, WIS: 1})
    expect(setBackground(chosen, 'srd-2024_sage').abilities.originBonuses).toEqual({})
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

  it('ends a non-caster at the skills step', () => {
    const c = setClass(createDraft(), 'srd-2024_fighter')
    expect(nextStep(c, 'skills')).toBeNull()
    expect(nextStep(c, 'background')).toBe('equipment')
  })

  it('offers the spells step to a caster', () => {
    const c = setClass(createDraft(), 'srd-2024_wizard')
    expect(isStepApplicable('spells', c)).toBe(true)
    expect(nextStep(c, 'skills')).toBe('spells')
  })

  it('drops spells the new class cannot cast', () => {
    let c = setClass(createDraft(), 'srd-2024_wizard')
    c = toggleSpell(c, 'srd-2024_fire-bolt')
    expect(setClass(c, 'srd-2024_fighter').spellIds).toEqual([])
  })

  it('deletes by id', async () => {
    await characterStore.remove('abc-123')
    expect(authed.del).toHaveBeenCalledWith('characters/abc-123')
  })
})

describe('character equipment', () => {
    it('tracks the purse as starting gold minus purchases', () => {
    let c = setEquipmentChoice({ ...createDraft(), classId: 'srd-2024_fighter' }, 'class', 'B')
    expect(purseCp(c)).toBe(7500)

    c = buyItem(c, 'srd-2024_chain-mail')
    expect(purseCp(c)).toBe(0)
    expect(purseCp(buyItem(c, 'srd-2024_rope'))).toBe(-100)
  })

  it('blocks the equipment step while overdrawn or unchosen', () => {
    const base = { ...createDraft(), classId: 'srd-2024_fighter', backgroundId: 'srd-2024_acolyte' }
    expect(isStepValid('equipment', base)).toBe(false)

    const chosen = setEquipmentChoice(base, 'class', 'B')
    expect(isStepValid('equipment', chosen)).toBe(true)
    expect(isStepValid('equipment', buyItem(buyItem(chosen, 'srd-2024_chain-mail'), 'srd-2024_rope'))).toBe(false)
  })

  it('expands granted items by quantity and counts them for armour class', () => {
    const c = setEquipmentChoice({ ...createDraft(), classId: 'srd-2024_fighter' }, 'class', 'A')
    expect(ownedItemIds(c)).toContain('srd-2024_chain-mail')
    expect(derived({ ...c, abilities: { ...c.abilities, base: { DEX: 13 } } }).armorClass).toBe(16)
  })

  it('clears only its own equipment choice when a source changes', () => {
    let c = setEquipmentChoice({ ...createDraft(), classId: 'srd-2024_fighter' }, 'class', 'B')
    c = setEquipmentChoice(c, 'background', 'A')
    expect(setClass(c, 'srd-2024_wizard').equipmentChoice).toEqual({ class: null, background: 'A' })
  })
})