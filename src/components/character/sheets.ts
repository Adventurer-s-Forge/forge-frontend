import type { Ability, Character } from "../../characters/character";
import { ABILITIES, abilityModifier, finalScores, formatModifier, proficiencyBonus } from "../../characters/abilities";
import { catalog, getBg, getClass, getEquipment, getRace, getSkill } from "../../data/catalog";
import { SPELLCASTING_ABILITY, classKey } from "../../data/classRules";

export type AbilityRow = {
  ability: Ability
  assigned?: number
  origin: number
  total?: number
  modifier?: number
}

export type SkillRow = {
  id: string
  name: string
  ability: Ability
  source: SkillSource
  abilityMod?: number
  bonus?: number
  math: string
  stealthDisadvantage: boolean
}

export function abilityRows(c: Character): AbilityRow[] {
  const totals = finalScores(c.abilities.base, c.abilities.originBonuses)
  return ABILITIES.map((ability) => {
    const total = totals[ability]
    return {
      ability,
      assigned: c.abilities.base[ability],
      origin: c.abilities.originBonuses[ability] ?? 0,
      total,
      modifier: total === undefined ? undefined : abilityModifier(total),
    }
  })
}

/** Skills Section */

export type SkillSource = { kind: 'pick' | 'background'; label: string; expert: boolean } | null

export function skillSource(c: Character, skillId: string): SkillSource {
  const expert = c.expertiseIds.includes(skillId)

  if (c.proficientSkillIds.includes(skillId)) {
    return { kind: 'pick', label: `${getClass(c.classId)?.name ?? 'Class'} pick`, expert }
  }
  const background = getBg(c.backgroundId)
  if (background?.skillIds.includes(skillId)) {
    return { kind: 'background', label: background.name, expert }
  }
  return null
}

export const isSkillProficient = (c: Character, skillId: string) =>
  skillSource(c, skillId) !== null

export function skillModifier(c: Character, skillId: string): number | undefined {
  const skill = getSkill(skillId)
  if (!skill) return undefined

  const score = finalScores(c.abilities.base, c.abilities.originBonuses)[skill.ability]
  if (score === undefined) return undefined

  const source = skillSource(c, skillId)
  const multiplier = source ? (source.expert ? 2 : 1) : 0
  return abilityModifier(score) + proficiencyBonus(c.level) * multiplier
}

export function skillRows(c: Character): SkillRow[] {
  const totals = finalScores(c.abilities.base, c.abilities.originBonuses)
  const pb = proficiencyBonus(c.level)
  const stealthPenalty = armorStealthDisadvantage(c)

  return catalog.skills.map((skill) => {
    const score = totals[skill.ability]
    const source = skillSource(c, skill.id)
    const multiplier = source ? (source.expert ? 2 : 1) : 0
    const abilityMod = score === undefined ? undefined : abilityModifier(score)
    const bonus = abilityMod === undefined ? undefined : abilityMod + pb * multiplier

    const math =
      abilityMod === undefined
        ? '\u2014'
        : multiplier === 0
          ? formatModifier(abilityMod)
          : `${formatModifier(abilityMod)} ${formatModifier(pb * multiplier)}`

    return {
      id: skill.id,
      name: skill.name,
      ability: skill.ability,
      source,
      abilityMod,
      bonus,
      math,
      stealthDisadvantage: skill.id === 'stealth' && stealthPenalty !== null,
    }
  })
}

export const startingCp = (c: Character) => (c.equipmentChoice.class?.goldCp ?? 0) + (c.equipmentChoice.background?.goldCp ?? 0)

export function spentCp(c: Character): number {
  return c.purchasedItemIds.reduce((sum, id) => sum + (getEquipment(id)?.costCp ?? 0), 0)
}

export const purseCp = (c: Character) => c.walletCp

/** Granted by the chosen option, expanded by qty, plus anything bought */
export function ownedItemIds(c: Character): string[] {
  const granted = (['class', 'background'] as const).flatMap((source) =>
    (c.equipmentChoice[source]?.grants ?? []).flatMap((grant) =>
      grant.itemId === null ? [] : (Array(grant.quantity).fill(grant.itemId) as string[]),
    ),
  )
  return [...granted, ...c.purchasedItemIds]
}

export function armorStealthDisadvantage(c: Character): string | null {
  for (const id of ownedItemIds(c)) {
    const item = catalog.equipment.find((eq) => eq.id === id)
    if (item?.armor?.stealthDisadvantage) return item.name
  }
  return null
}

/** Armor sets a base Armor Class (AC) rating and a shield adds to it. */

function armorClass(c: Character, dexMod: number): number {
  let base = 10 + dexMod
  let bonus = 0

  for (const id of ownedItemIds(c)) {
    const armor = catalog.equipment.find((eq) => eq.id === id)?.armor
    if (!armor) continue

    if (armor.base < 10) {
      bonus += armor.base
      continue
    }
    const dex = armor.addDex
      ? armor.capDex === null
        ? dexMod
        : Math.min(dexMod, armor.capDex)
      : 0
    base = Math.max(base, armor.base + dex)
  }
  return base + bonus
}

export type SavingThrow = { ability: Ability; modifier: number; proficient: boolean }

export type Derived = {
  proficiencyBonus: number
  intitiative?: number
  speed?: number
  size?: string
  hitPoints?: number
  armorClass?: number
  passivePerception?: number
  savingThrows: SavingThrow[]
}

export function derived(c: Character): Derived {
  const pb = proficiencyBonus(c.level)
  const totals = finalScores(c.abilities.base, c.abilities.originBonuses)
  const race = getRace(c.raceId)
  const cls = getClass(c.classId)

  const dexMod = totals.DEX === undefined ? undefined : abilityModifier(totals.DEX)
  const conMod = totals.CON === undefined ? undefined : abilityModifier(totals.CON)
  const perception = skillModifier(c, 'perception')
  const proficientSaves = cls?.savingThrows ?? []

  return {
    proficiencyBonus: pb,
    intitiative: dexMod,
    speed: race?.speed,
    size: race ? (c.sizeChoice ?? race.sizes[0]) : undefined,
    hitPoints: cls && conMod !== undefined ? cls.hitDie + conMod : undefined,
    armorClass: dexMod === undefined ? undefined : armorClass(c, dexMod),
    passivePerception: perception === undefined ? undefined : 10 + perception,
    savingThrows: ABILITIES.flatMap((ability) => {
      const score = totals[ability]
      if (score === undefined) return []
      const proficient = proficientSaves.includes(ability)
      return [{ ability, proficient, modifier: abilityModifier(score) + (proficient ? pb : 0) }]
    }),
  }
}

/** Spells */

function spellcastingAbility(c: Character): Ability | undefined {
  const cls = getClass(c.classId)
  if (cls && cls.casterType !== 'NONE') {
    const own = SPELLCASTING_ABILITY[classKey(cls.id)]
    if (own) return own
  }

  const initiate = getBg(c.backgroundId)?.initiateClassNames[0]
  if (!initiate) return undefined
  const id = catalog.classes.find((k) => k.name.toLowerCase() === initiate.toLowerCase())?.id
  return id ? SPELLCASTING_ABILITY[classKey(id)] : undefined
}

export type SpellDerived = {
  ability?: Ability
  abilityModifier?: number
  saveDC?: number
  attackBonus?: number
  slots: number
}

export function spellDerived(c: Character): SpellDerived {
  const cls = getClass(c.classId)
  const slots = cls?.casterType === 'NONE' ? 0 : cls?.spellSlots ?? 0
  const ability = spellcastingAbility(c)
  if (!ability) return { slots }

  const score = finalScores(c.abilities.base, c.abilities.originBonuses)[ability]
  if (score === undefined) return { ability, slots }

  const pb = proficiencyBonus(c.level)
  const modifier = abilityModifier(score)
  return { ability, abilityModifier: modifier, saveDC: 8 + pb + modifier, attackBonus: pb + modifier, slots }
}