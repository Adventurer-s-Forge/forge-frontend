import type { Ability, AbilityScores } from "../characters/character"
import { SKILLS } from "./skills"
import type { Skill } from "./skills"


export type { Skill }

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
}

export type Background = {
  id: string
  name: string
  skillIds: string[]
}

export type Item = {
  id: string
  name: string
  category: 'weapon' | 'armor' | 'gear'
  desc: string
}

export type Catalog = {
  skills: readonly Skill[]
  races: Race[]
  classes: CharacterClass[]
  backgrounds: Background[]
  items: Item[]
}

export const catalog: Catalog = {
  skills: SKILLS,
  races: [],
  classes: [],
  backgrounds: [],
  items: [],
}

export function seedCatalog(next: Omit<Catalog, 'skills'>): void {
  catalog.races = next.races
  catalog.classes = next.classes
  catalog.backgrounds = next.backgrounds
  catalog.items = next.items
}

export const getRace = (id: string | null) => catalog.races.find((race) => race.id === id)
export const getClass = (id: string | null) => catalog.classes.find((cls) => cls.id === id)
export const getBg = (id: string | null) => catalog.backgrounds.find((bg) => bg.id === id)
export const getSkill = (id: string) => catalog.skills.find((skill) => skill.id === id)

export function classSkillOptions(cls: CharacterClass, background: Background | undefined): string[] {
  const pool = cls.skillChoices.from === 'any' ? catalog.skills.map((skill) => skill.id) : cls.skillChoices.from
  const granted = background?.skillIds ?? []
  return pool.filter((id) => !granted.includes(id))
}