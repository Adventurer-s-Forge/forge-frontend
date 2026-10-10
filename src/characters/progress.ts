import { STEPS } from './character'
import type { Ability, AbilityMethod, AbilityScores, Character, StepId } from './character'
import { ABILITIES, POINT_BUY_BUDGET, POINT_BUY_MIN, pointBuySpent, STD_ARR } from './abilities'
import { classSkillOptions, getBg, getClass, getRace, spellBudget, spellOptions } from '../data/catalog'

function sameValues(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const sortedB = [...b].sort((x, y) => x - y)
  return [...a].sort((x, y) => x - y).every((value, i) => value === sortedB[i])
}

function attributesValid(c: Character): boolean {
  const { method, base, rolled, racialChoices } = c.abilities
  const scores = ABILITIES.map((ability) => base[ability])
  if (!method || scores.some((score) => score === undefined)) return false
  const assigned = scores as number[]

  if (method === 'standard' && !sameValues(assigned, STD_ARR)) return false
  if (method === 'roll' && !(rolled.length === 6 && sameValues(assigned, rolled))) return false
  if (method === 'pointbuy' && pointBuySpent(base) > POINT_BUY_BUDGET) return false

  const choice = getRace(c.raceId)?.abilityChoice
  if (choice) {
    const distinct = new Set(racialChoices).size === racialChoices.length
    const allowed = racialChoices.every((ability) => !choice.exclude.includes(ability))
    if(racialChoices.length !== choice.count || !distinct || !allowed) return false
  }
  return true
}

function skillsValid(c: Character): boolean {
  const cls = getClass(c.classId)
  if (!cls) return false
  const options = classSkillOptions(cls, getBg(c.backgroundId))
  return (
    c.proficientSkillIds.length === cls.skillChoices.count &&
    new Set(c.proficientSkillIds).size === c.proficientSkillIds.length &&
    c.proficientSkillIds.every((id) => options.includes(id))
  )
}

function spellsValid (c: Character): boolean {
  const cls = getClass(c.classId)
  const bg = getBg(c.backgroundId)
  const options = spellOptions(cls, bg)
  if (options.length === 0) return true

  if (new Set(c.spellIds).size !== c.spellIds.length) return false
  const chosen = c.spellIds.map((id) => options.find((spell) => spell.id === id))
  if (chosen.some((spell) => spell === undefined)) return false

  const budget = spellBudget(cls, bg)
  const cantrips = chosen.filter((spell) => spell!.level === 0).length
  return cantrips === budget.cantrips && chosen.length - cantrips === budget.prepared
}

export function isStepValid(step: StepId, c: Character): boolean {
  switch (step) {
    case 'name':
      return c.name.trim() !== ''
    case 'race':
      return getRace(c.raceId) !== undefined
    case 'class':
      return getClass(c.classId) !== undefined
    case 'background':
      return getBg(c.backgroundId) !== undefined
    case 'attributes':
      return attributesValid(c)
    case 'skills':
      return skillsValid(c)
    case 'spells':
      return spellsValid(c)
    case 'equipment':
      return true
  }
}

export function firstIncompleteStep(c: Character): StepId | null {
  return (
    STEPS.find(
      ({ id }) =>
        isStepApplicable(id, c) && (!c.completedSteps.includes(id) || !isStepValid(id, c)),
    )?.id ?? null
  )
}

export function isComplete(c: Character): boolean {
  return firstIncompleteStep(c) === null
}

export function nextStep(c: Character, from: StepId): StepId | null {
  const index = STEPS.findIndex((s) => s.id === from)
  return STEPS.slice(index + 1).find((s) => isStepApplicable(s.id, c))?.id ?? null
}

export function prevStep(c: Character, from: StepId): StepId | null {
  const index = STEPS.findIndex((s) => s.id === from)
  return STEPS.slice(0, index).reverse().find((s) => isStepApplicable(s.id, c))?.id ?? null
}

export function completeStep(c: Character, step: StepId): Character {
  if (c.completedSteps.includes(step)) return c
  return { ...c, completedSteps: [...c.completedSteps, step]} 
}

export function setRace(c: Character, raceId: string): Character {
  if (raceId === c.raceId) return c
  const choicesAffected = Boolean(getRace(c.raceId)?.abilityChoice || getRace(raceId)?.abilityChoice)
  return {
    ...c,
    raceId,
    abilities: choicesAffected ? { ...c.abilities, racialChoices: [] } : c.abilities,
  }
}

function keepOfferedSkills(c: Character): Character {
  const cls = getClass(c.classId)
  if (!cls) return { ...c, proficientSkillIds: [] }
  const options = classSkillOptions(cls, getBg(c.backgroundId))
  return { ...c, proficientSkillIds: c.proficientSkillIds.filter((id) => options.includes(id)) }
}

function keepLegalSpells(c: Character): Character {
  const options = spellOptions(getClass(c.classId), getBg(c.backgroundId))
  const legal = c.spellIds.filter((id) => options.some((spell) => spell.id === id))
  return legal.length === c.spellIds.length ? c : { ...c, spellIds: legal }
}

export function setClass(c: Character, classId: string): Character {
  if (classId === c.classId) return c
  return keepLegalSpells(keepOfferedSkills({ ...c, classId }))
}

export function setBackground(c: Character, backgroundId: string): Character {
  if (backgroundId === c.backgroundId) return c
  return keepLegalSpells(keepOfferedSkills({ ...c, backgroundId }))
}

export function setAbilityMethod(c: Character, method: AbilityMethod): Character {
  if (method === c.abilities.method) return c
  const m = POINT_BUY_MIN
  const base: Partial<AbilityScores> =
    method === 'pointbuy' ? { STR: m, DEX: m, CON: m, INT: m, WIS: m, CHA: m } : {}
  return { ...c, abilities: { ...c.abilities, method, base, rolled: [] } }
}

export function setName(c: Character, name: string): Character {
  return { ...c, name }
}

export function setAbilityScore(
  c: Character,
  ability: Ability,
  score: number | undefined,
): Character {
  const base = { ...c.abilities.base }
  if (score === undefined) delete base[ability]
  else base[ability] = score
  return { ...c, abilities: { ...c.abilities, base } }
}

export function setRacialChoices(c: Character, choices: Ability[]): Character {
  return { ...c, abilities: { ...c.abilities, racialChoices: choices } }
}

export function setRolledPool(c: Character, rolled: number[]): Character {
  return { ...c, abilities: { ...c.abilities, rolled, base: {} } }
}

export function toggleSkill(c: Character, skillId: string, max: number): Character {
  if (c.proficientSkillIds.includes(skillId)) {
    return { ...c, proficientSkillIds: c.proficientSkillIds.filter((id) => id !== skillId) }
  }
  if (c.proficientSkillIds.length >= max) return c
  return { ...c, proficientSkillIds: [...c.proficientSkillIds, skillId] }
}

export function toggleSpell(c: Character, spellId: string): Character {
  return c.spellIds.includes(spellId)
    ? { ...c, spellIds: c.spellIds.filter((id) => id !== spellId) }
    : { ...c, spellIds: [...c.spellIds, spellId] }
}

export function toggleEquipment(c: Character, itemId: string): Character {
  return c.equipmentIds.includes(itemId)
    ? { ...c, equipmentIds: c.equipmentIds.filter((id) => id !== itemId) }
    : { ...c, equipmentIds: [...c.equipmentIds, itemId] }
}

export function isStepReachable(step: StepId, c: Character): boolean {
  if (!isStepApplicable(step, c)) return false
  const index = STEPS.findIndex((s) => s.id === step)
  return STEPS.slice(0, index)
    .filter((s) => isStepApplicable(s.id, c))
    .every((s) =>c.completedSteps.includes(s.id) && isStepValid(s.id, c))
}

export function isStepApplicable(step: StepId, c: Character): boolean {
  if (step !== 'spells') return true
  return spellOptions(getClass(c.classId), getBg(c.backgroundId)).length > 0
}