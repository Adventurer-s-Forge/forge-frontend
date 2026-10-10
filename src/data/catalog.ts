import type { Ability, AbilityScores } from "../characters/character"
import { SKILLS } from "./skills"
import type { Skill } from "./skills"


export type { Skill }

export type CasterType = 'NONE' | 'FULL' | 'HALF' | 'PACT'

export type Race = {
  id: string
  name: string
  size: 'Small' | 'Medium'
  speed: number
  abilityBonuses: Partial<AbilityScores>
  abilityChoice?: { count: number; amount: number; exclude: Ability[] }
}

export type CharacterClass = {
  id: string
  name: string
  hitDie: number
  primaryAbilities: Ability[]
  savingThrows: Ability[]
  skillChoices: { count: number; from: string[] | 'any' }
  casterType: CasterType
  spellCounts: { cantrips: number; prepared: number }
}

export type Background = {
  id: string
  name: string
  skillIds: string[]
  initiateClassNames: string[]
}

export type Equipment = {
  id: string
  name: string
  category: 'weapon' | 'armor' | 'gear'
  desc: string
}

export type Spell = {
  id: string
  name: string
  level: number
  school: string
  classIds: string[]
  desc: string
  concentration: boolean
  ritual: boolean
  castingTime: string
  range: string
  duration: string
}

export type Catalog = {
  skills: readonly Skill[]
  races: Race[]
  classes: CharacterClass[]
  backgrounds: Background[]
  spells: Spell[]
  equipment: Equipment[]
}

export const catalog: Catalog = {
  skills: SKILLS,
  races: [],
  classes: [],
  backgrounds: [],
  spells: [],
  equipment: [],
}

export function seedCatalog(next: Omit<Catalog, 'skills'>): void {
  catalog.races = next.races
  catalog.classes = next.classes
  catalog.backgrounds = next.backgrounds
  catalog.spells = next.spells
  catalog.equipment = next.equipment
}

export const getRace = (id: string | null) => catalog.races.find((race) => race.id === id)
export const getClass = (id: string | null) => catalog.classes.find((cls) => cls.id === id)
export const getBg = (id: string | null) => catalog.backgrounds.find((bg) => bg.id === id)
export const getSkill = (id: string) => catalog.skills.find((skill) => skill.id === id)
export const getSpell = (id: string) => catalog.spells.find((spell) => spell.id === id)

export function classSkillOptions(cls: CharacterClass, background: Background | undefined): string[] {
  const pool = cls.skillChoices.from === 'any' ? catalog.skills.map((skill) => skill.id) : cls.skillChoices.from
  const granted = background?.skillIds ?? []
  return pool.filter((id) => !granted.includes(id))
}

/** Only cantrips and 1st level spells are reachable at character level 1. **/

const MAX_SPELL_LEVEL_AT_1 = 1

const classIdByName = (name: string) => catalog.classes.find((cls) => cls.name.toLowerCase() === name.toLowerCase())?.id

export function spellLists(cls: CharacterClass | undefined, bg: Background | undefined): string[] {
  const lists = cls && cls.casterType !== 'NONE' ? [cls.id] : []
  for (const name of bg?.initiateClassNames ?? []) {
    const id = classIdByName(name)
    if (id && !lists.includes(id)) lists.push(id)
  }
  return lists
}

export function spellOptions(
  cls: CharacterClass | undefined,
  bg: Background | undefined,
): Spell[] {
  const lists = spellLists(cls, bg)
  if (lists.length === 0) return []
  return catalog.spells.filter(
    (spell) => spell.level <= MAX_SPELL_LEVEL_AT_1 && spell.classIds.some((id) => lists.includes(id))
  )
}

export function spellBudget(
  cls: CharacterClass | undefined,
  bg: Background | undefined,
): { cantrips: number; prepared: number } {
  const own = cls && cls.casterType !== 'NONE' ? cls.spellCounts : { cantrips: 0, prepared: 0 }
  const initiates = bg?.initiateClassNames.length ?? 0
  return { cantrips : own.cantrips + initiates * 2, prepared: own.prepared + initiates }
}