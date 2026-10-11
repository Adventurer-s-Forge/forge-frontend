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

import type { Ability } from "../characters/character";
import type { Background, CasterType, CharacterClass, Equipment, Race, Size, Spell } from "./catalog";
import type { Envelope } from "../lib/api";
import { CLASS_SKILL_CHOICES, classKey } from "./classRules";
import { skillIdsFromNames } from "./skills";

type Trait = { name: string; desc: string }

export type RawRace = { traits: Trait[]; subspecies_of: string | null }
export type RawClass = {
  hit_dice: string
  saving_throws: { name: string }[]
  subclass_of: string | null
  caster_type: CasterType | null
  features: { name: string; data_for_class_table: { level: number; column_value: string }[] | null }[]
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

const trait = (traits: Trait[], name: string) => traits.find((t) => t.name === name)?.desc ?? ''

// RACE

function sizes(desc: string): Size[] {
  const found = [...desc.matchAll(/\b(Small|Medium)\b/g)].map((m) => m[1] as Size)
  const unique = [...new Set(found)]
  return unique.length > 0 ? unique : ['Medium']
}

export function toRace(record: Envelope<RawRace>): Race {
  return {
    id: record.key,
    name: record.name,
    sizes: sizes(trait(record.data.traits, 'Size')),
    speed: Number(trait(record.data.traits, 'Speed').match(/(\d+)\s*feet/i)?.[1] ?? 30),
  }
}

// CLASS

function classTableAtLevel1(features: RawClass['features'], column: string): number {
  const rows = features.find((f) => f.name === column)?.data_for_class_table ?? []
  const value = Number(rows.find((row) => row.level === 1)?.column_value)
  return Number.isFinite(value) ? value : 0
}

export function toClass(record: Envelope<RawClass>): CharacterClass {
  const choices = CLASS_SKILL_CHOICES[classKey(record.key)] ?? { count: 2, from: 'any' as const }

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
    },
    spellSlots:
      classTableAtLevel1(record.data.features, '1st') ||
      classTableAtLevel1(record.data.features, 'Spell Slots'),
  }
}

export const isBaseClass = (record: Envelope<RawClass>) => record.data.subclass_of === null

// BACKGROUND

function abilityOptions(benefits: RawBackground['benefits']): Ability[] {
  const desc = benefits.find((benefit) => benefit.type === 'ability_score')?.desc ?? ''
  return desc.split(',').map((part) => ABILITY_BY_NAME[part.trim().toLowerCase()]).filter((ability): ability is Ability => ability !== undefined)
}

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
    abilityOptions: abilityOptions(record.data.benefits)
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
  const armor = record.data.armor
  return {
    id: record.key,
    name: record.name,
    category: category(record.data.category.key),
    desc: record.data.desc,
    armor:
      armor?.ac_base === undefined
        ? undefined
        : { base: armor.ac_base, addDex: armor.ac_add_dexmod ?? false, capDex: armor.ac_cap_dexmod ?? null }
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