import type { Ability, Character } from "../../characters/character";
import { ABILITIES, abilityModifier, finalScores, proficiencyBonus } from "../../characters/abilities";
import { catalog, getBg, getClass, getRace, getSkill } from "../../data/catalog";
import { SPELLCASTING_ABILITY, classKey } from "../../data/classRules";

export type AbilityRow = {
  ability: Ability
  assigned?: number
  origin: number
  total?: number
  modifier?: number
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

export function isSkillProficient(c: Character, skillId: string): boolean {
  const granted = getBg(c.backgroundId)?.skillIds ?? []
  return c.proficientSkillIds.includes(skillId) || granted.includes(skillId)
}

export function skillModifier(c: Character, skillId: string): number | undefined {
  const skill = getSkill(skillId)
  if (!skill) return undefined
  const score = finalScores(c.abilities.base, c.abilities.originBonuses)[skill.ability]
  if (score === undefined) return undefined
  return abilityModifier(score) + (isSkillProficient(c, skillId) ? proficiencyBonus(c.level) : 0)
}

/** Armor sets a base Armor Class (AC) rating and a shield adds to it. */

function armorClass(c: Character, dexMod: number): number {
  let base = 10 + dexMod
  let bonus = 0

  for (const id of c.equipmentIds) {
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