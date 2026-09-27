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
  toggleItem,
  toggleSkill
} from "../characters/progress";
import { characterStore } from "../characters/storage";
import { getRace, seedCatalog } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";

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
    skillIds: ['perception', 'survival'],
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
      { id: 'srd_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'], skillChoices: CLASS_SKILL_CHOICES.srd_fighter },
      { id: 'srd_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'], skillChoices: CLASS_SKILL_CHOICES.srd_wizard },
    ],
    backgrounds: [{ id: 'srd_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'] }],
    items: [],
  })
})

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
    expect(c.skillIds).toEqual([])
    expect(firstIncompleteStep(c)).toBe('skills')
  })

  it('reopens attributes when swithcing to a race with ability choices', () => {
    expect(firstIncompleteStep(setRace(finishedFighter(), 'srd_half-elf'))).toBe('attributes')
  })
})

describe('character storage', () => {
  beforeEach(() => localStorage.clear())

  it('refues to save a character without a name', async () => {
    await expect(characterStore.save('u1', createDraft())).rejects.toThrow('needs a name')
  })

  it('updates in place and keeps each account separate', async () => {
    const draft = { ...createDraft(), name: 'Arkes' }
    await characterStore.save('u1', draft)
    await characterStore.save('u1', { ...draft, name: 'Arkes the Mighty' })

    expect(await characterStore.list('u1')).toMatchObject([{ name: 'Arkes the Mighty' }])
    expect(await characterStore.list('u2')).toEqual([])
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

    expect(c.skillIds).toEqual(['stealth', 'arcana'])
    expect(toggleSkill(c, 'stealth', 2).skillIds).toEqual(['arcana'])
  })

  it('toggle itemss with no cap', () => {
    let c = toggleItem(createDraft(), 'srd_dagger')
    c = toggleItem(c, 'srd_rope')

    expect(c.itemIds).toEqual(['srd_dagger', 'srd_rope'])
    expect(toggleItem(c, 'srd_dagger').itemIds).toEqual(['srd_rope'])
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
})