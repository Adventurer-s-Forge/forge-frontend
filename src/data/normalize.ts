/** 
 *  THIS IS TEMPORARY
 * 
 *  prose parsing that belongs in the backend ingest step
 * 
 * 
 *  Open5e v2 species and background records carry no numeric fields; ability
 *  bonuses, speed, size and skill proficiencies exists only as English sentences.
 * 
 *  When the backend supplies a normalized block, DELETE THIS FILE and read the
 *  fields straight off the envelope. Nothing else imports these functions.
 *
 **/

import type { Ability, AbilityScores } from "../characters/character";
import type { Background, CasterType, CharacterClass, Equipment, Race, Spell } from "./catalog";
import type { Envelope } from "../lib/api";
import { CLASS_SKILL_CHOICES } from "./classRules";
import { skillIdsFromNames } from "./skills";

type Trait = { name: string; desc: string }

export type RawRace = { traits: Trait[]; subspecies_of: string | null }
export type RawClass = {
  hit_dice: string
  saving_throws: { name: string }[]
  subclass_of: string | null
  caster_type: CasterType | null
  features: { name: string; data_for_class_tables: { level: number; column_value: string }[] | null }[]
}
export type RawSpell = {
  level: number
  school: { name: string } | null
  classes: { name: string; key: string }[] | null
  desc: string
  concentration: boolean | null
  ritual: boolean | null
  casting_time: string | null
  range_text: string| null
  duration: string | null
}
export type RawBackground = { benefits: { type: string; desc: string }[] }
export type RawEquipment = {
  category: { key: string; name: string }
  desc: string
  weapon: { damage_dice?: string; damage_type?: { name: string } | null; is_martial?: boolean } | null
  armor: { ac_base?: number; ac_add_dexmod?: boolean; ac_cap_dexmod?: number | null } | null
}

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
}

const ALL_ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3 }

const trait = (traits: Trait[], name: string) => traits.find((t) => t.name === name)?.desc ?? ''

// RACE

function abilityBonuses(desc: string): Partial<AbilityScores> {
  const each = desc.match(/ability scores each increase by (\d+)/i)
  if (each) {
    const amount = Number(each[1])
    return Object.fromEntries(ALL_ABILITIES.map((a) => [a, amount]))
  }

  const bonuses: Partial<AbilityScores> = {}
  for (const match of desc.matchAll(/your (\w+) score increases by (\d+)/gi)) {
    const ability = ABILITY_BY_NAME[match[1].toLocaleLowerCase()]
    if (ability) bonuses[ability] = Number(match[2])
  }

  return bonuses
}

function abilityChoice(
  desc: string,
  fixed: Partial<AbilityScores>,
): Race['abilityChoice'] {
  const match = desc.match(
    /(one|two|three) other ability scores? of your choice increases by (\d+)/i,
  )
  if (!match) return undefined

  return {
    count: WORDS[match[1].toLowerCase()] ?? 1,
    amount: Number(match[2]),
    exclude: Object.keys(fixed) as Ability[],
  }
}

export function toRace(record: Envelope<RawRace>): Race {
  const increase = trait(record.data.traits, 'Ability Score Increase')
  const fixed = abilityBonuses(increase)

  return {
    id: record.key,
    name: record.name,
    size: /^\s*small/i.test(trait(record.data.traits, 'Size')) ? 'Small' : 'Medium',
    speed: Number(trait(record.data.traits, 'Speed').match(/(\d+)\s*feet/i)?.[1] ?? 30),
    abilityBonuses: fixed,
    abilityChoice: abilityChoice(increase, fixed),
  }
}

// CLASS

function classTableAtLevel1(features: RawClass['features'], column: string): number {
  const rows = features.find((f) => f.name === column)?.data_for_class_tables ?? []
  const value = Number(rows.find((row) => row.level === 1)?.column_value)
  return Number.isFinite(value) ? value : 0
}

export function toClass(record: Envelope<RawClass>): CharacterClass {
  const choices = CLASS_SKILL_CHOICES[record.key] ?? { count: 2, from: 'any' as const }

  return {
    id: record.key,
    name: record.name,
    hitDie: Number(record.data.hit_dice.replace(/^d/i, '')),
    savingThrows: record.data.saving_throws
      .map((save) => ABILITY_BY_NAME[save.name.toLowerCase()])
      .filter((ability): ability is Ability => ability !== undefined),
    primaryAbilities: [],
    skillChoices: choices,
    casterType: record.data.caster_type ?? 'NONE',
    spellCounts: {
      cantrips: classTableAtLevel1(record.data.features, 'Cantrips'),
      prepared: classTableAtLevel1(record.data.features, 'Prepared Spells'),
    }
  }
}

export const isBaseClass = (record: Envelope<RawClass>) => record.data.subclass_of === null

// BACKGROUND

function initiateClassNames(benefits: RawBackground['benefits']): string[] {
  return benefits
    .filter((benefit) => benefit.type === 'feat')
    .map((benefit) => /^Magic Initiate \(([^)]+)\)/.exec(benefit.desc)?.[1]?.trim())
    .filter((name): name is string => name !== undefined)
}

export function toBackground(record: Envelope<RawBackground>): Background {
  const proficiencies = record.data.benefits.find(
    (benefit) => benefit.type === 'skill_proficiency',
  )

  return {
    id: record.key,
    name: record.name,
    skillIds: skillIdsFromNames(proficiencies?.desc ?? ''),
    initiateClassNames: initiateClassNames(record.data.benefits),
  }
}

// EQUIPMENT

const ARMOR_CATEGORIES = new Set(['armor', 'shield'])
const WEAPON_CATEGORIES = new Set(['weapon', 'ammunition'])

function category(key: string): Equipment['category'] {
  if (ARMOR_CATEGORIES.has(key)) return 'armor'
  if (WEAPON_CATEGORIES.has(key)) return 'weapon'
  return 'gear'
}

export function toEquipment(record: Envelope<RawEquipment>): Equipment {
  return {
    id: record.key,
    name: record.name,
    category: category(record.data.category.key),
    desc: record.data.desc,
  }
}

// SPELLS

export function toSpell(record: Envelope<RawSpell>): Spell {
  return {
    id: record.key,
    name: record.name,
    level: record.data.level,
    school: record.data.school?.name ?? '',
    classIds: (record.data.classes ?? []).map((cls) => cls.key),
    desc: record.data.desc,
    concentration: record.data.concentration ?? false,
    ritual: record.data.ritual ?? false,
    castingTime: record.data.casting_time ?? '',
    range: record.data.range_text ?? '',
    duration: record.data.duration ?? '',
  }
}