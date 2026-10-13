import { STEPS } from './character'
import type { Ability, AbilityMethod, AbilityScores, Character, StepId } from './character'
import { ABILITIES, ABILITY_CAP, finalScores, originSpreadValid, POINT_BUY_BUDGET, POINT_BUY_MIN, pointBuySpent, STD_ARR } from './abilities'
import { classSkillOptions, expertiseCounts, getBg, getClass, getRace, spellBudget, spellOptions, type Size } from '../data/catalog'
import { purseCp } from '../components/character/sheets'

function sameValues(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const sortedB = [...b].sort((x, y) => x - y)
  return [...a].sort((x, y) => x - y).every((value, i) => value === sortedB[i])
}

function attributesValid(c: Character): boolean {
  const { method, base, rolled, originBonuses } = c.abilities
  const scores = ABILITIES.map((ability) => base[ability])
  if (!method || scores.some((score) => score === undefined)) return false
  const assigned = scores as number[]

  if (method === 'standard' && !sameValues(assigned, STD_ARR)) return false
  if (method === 'roll' && !(rolled.length === 6 && sameValues(assigned, rolled))) return false
  if (method === 'pointbuy' && pointBuySpent(base) > POINT_BUY_BUDGET) return false

  const options = getBg(c.backgroundId)?.abilityOptions ?? []
  if (options.length === 0) return false
  if (!ABILITIES.every((a) => originBonuses[a] === undefined || options.includes(a))) return false
  if (!originSpreadValid(originBonuses)) return false

  const totals = finalScores(base, originBonuses)
  return ABILITIES.every((ability) => (totals[ability] ?? 0) <= ABILITY_CAP)
}

function skillsValid(c: Character): boolean {
  const cls = getClass(c.classId)
  if (!cls) return false

  const options = classSkillOptions(cls, getBg(c.backgroundId))
  if (
    c.proficientSkillIds.length !== cls.skillChoices.count ||
    new Set(c.proficientSkillIds).size !== c.proficientSkillIds.length ||
    !c.proficientSkillIds.every((id) => options.includes(id))
  ) {
    return false
  }

  const want = expertiseCounts(cls, c.level)
  const granted = getBg(c.backgroundId)?.skillIds ?? []
  return (
    c.expertiseIds.length === want &&
    new Set(c.expertiseIds).size === c.expertiseIds.length &&
    c.expertiseIds.every((id) => c.proficientSkillIds.includes(id) || granted.includes(id))
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
      return equipmentValid(c)
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
  return raceId === c.raceId ? c : { ...c, raceId, sizeChoice: null }
}

export function setSizeChoice(c: Character, sizeChoice: Size): Character {
  return { ...c, abilities: c.abilities, sizeChoice }
}

function keepOfferedSkills(c: Character): Character {
  const cls = getClass(c.classId)
  if (!cls) return { ...c, proficientSkillIds: [] }

  const options = classSkillOptions(cls, getBg(c.backgroundId))
  return keepLegalExpertise({
    ...c,
    proficientSkillIds: c.proficientSkillIds.filter((id) => options.includes(id))
  })
}

function keepLegalSpells(c: Character): Character {
  const options = spellOptions(getClass(c.classId), getBg(c.backgroundId))
  const legal = c.spellIds.filter((id) => options.some((spell) => spell.id === id))
  return legal.length === c.spellIds.length ? c : { ...c, spellIds: legal }
}

export function setClass(c: Character, classId: string): Character {
  if (classId === c.classId) return c
  const next = { ...c, classId, equipmentChoice: { ...c.equipmentChoice, class: null } }
  return keepLegalSpells(keepOfferedSkills(next))
}

export function setBackground(c: Character, backgroundId: string): Character {
  if (backgroundId === c.backgroundId) return c
  const next = {
    ...c,
    backgroundId,
    abilities: { ...c.abilities, originBonuses: {} },
    equipmentChoice: { ...c.equipmentChoice, background: null }
  }
  return keepLegalSpells(keepOfferedSkills(next))
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

export function setOriginBonuses(c: Character, originBonuses: Partial<AbilityScores>): Character {
  return { ...c, abilities: { ...c.abilities, originBonuses } }
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

export function setEquipmentChoice(
  c: Character,
  source: 'class' | 'background',
  key: string | null,
): Character {
  return { ...c, equipmentChoice: { ...c.equipmentChoice, [source]: key } }
}

export function buyItem(c: Character, itemId: string): Character {
  return{ ...c, purchasedItemIds: [...c.purchasedItemIds, itemId]}
}

export function sellItem(c: Character, itemId: string): Character {
  const at = c.purchasedItemIds.lastIndexOf(itemId)
  if (at === -1) return c
  return {
    ...c,
    purchasedItemIds: [...c.purchasedItemIds.slice(0, at), ...c.purchasedItemIds.slice(at + 1)],
  }
}

export function resetMarket(c: Character): Character {
  return c.purchasedItemIds.length === 0 ? c : { ...c, purchasedItemIds: [] }
}

function equipmentValid(c: Character): boolean {
  const cls = getClass(c.classId)
  const bg = getBg(c.backgroundId)
  if (cls && cls.startingEquipment.length > 0 && c.equipmentChoice.class === null) return false
  if (bg && bg.startingEquipment.length > 0 && c.equipmentChoice.background === null) return false
  return purseCp(c) >= 0
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

export function toggleExpertise(c: Character, skillId: string, max: number): Character {
  if (c.expertiseIds.includes(skillId)) {
    return { ...c, expertiseIds: c.expertiseIds.filter((id) => id !== skillId) }
  }
  if (c.expertiseIds.length >= max) return c
  return { ...c, expertiseIds: [...c.expertiseIds, skillId] }
}

function keepLegalExpertise(c: Character): Character {
  const granted = getBg(c.backgroundId)?.skillIds ?? []
  const legal = c.expertiseIds.filter(
    (id) => c.proficientSkillIds.includes(id) || granted.includes(id),
  )
  return legal.length === c.expertiseIds.length ? c : { ...c, expertiseIds: legal }
}