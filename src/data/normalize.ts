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
import type { Background, CharacterClass, Item, Race } from "./catalog";
import type { Envelope } from "../lib/api";
import { CLASS_SKILL_CHOICES } from "./classRules";
import { skillIdsFromNames } from "./skills";

type Trait = { name: string; desc: string }

export type RawRace = { traits: Trait[]; subspecies_of: string | null }
export type RawClass = {
  hit_dice: string
  saving_throws: { name: string }[]
  subclass_of: string | null
}
export type RawBackground = { benefits: { type: string; desc: string }[] }
export type RawItem = {
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
    size: /your size is small/i.test(trait(record.data.traits, 'Size'))
      ? 'Small'
      : 'Medium',
    speed: Number(trait(record.data.traits, 'Speed').match(/(\d+)\s*feet/i)?.[1] ?? 30),
    abilityBonuses: fixed,
    abilityChoice: abilityChoice(increase, fixed),
  }
}

// CLASS

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
  }
}

export const isBaseClass = (record: Envelope<RawClass>) => record.data.subclass_of === null

// BACKGROUND

export function toBackground(record: Envelope<RawBackground>): Background {
  const proficiencies = record.data.benefits.find(
    (benefit) => benefit.type === 'skill_proficiency',
  )

  return {
    id: record.key,
    name: record.name,
    skillIds: skillIdsFromNames(proficiencies?.desc ?? ''),
  }
}

// ITEMS

const ARMOR_CATEGORIES = new Set(['armor', 'shield'])
const WEAPON_CATEGORIES = new Set(['weapon', 'ammunition'])

function category(key: string): Item['category'] {
  if (ARMOR_CATEGORIES.has(key)) return 'armor'
  if (WEAPON_CATEGORIES.has(key)) return 'weapon'
  return 'gear'
}

export function toItem(record: Envelope<RawItem>): Item {
  return {
    id: record.key,
    name: record.name,
    category: category(record.data.category.key),
    desc: record.data.desc,
  }
}