/** This was originally set as temporary. But as of right now 10/20/26
 * This is part of the frontend until backend fully transfers it. */

import type { Ability } from "../characters/character";
import type {
  Background,
  CasterType,
  CharacterClass,
  ClassFeature,
  Equipment,
  EquipmentGrant,
  EquipmentOption,
  Race,
  Size,
  Spell
} from "./catalog";
import type { Envelope } from "../lib/api";
import { CLASS_SKILL_CHOICES, classKey } from "./classRules";
import { skillIdsFromNames } from "./skills";
import { gpToCp, parseCostCp } from "../characters/currency";

type Trait = { name: string; desc: string }

export type RawRace = { traits: Trait[]; subspecies_of: string | null }
export type RawClass = {
  hit_dice: string
  saving_throws: { name: string }[]
  subclass_of: string | null
  caster_type: CasterType | null
  features: {
    name: string
    desc: string
    gained_at: { level: number | null }[] | null
    data_for_class_table: { level: number; column_value: string }[] | null
  }[]
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
  cost: string | null
  armor: { ac_base?: number; ac_add_dexmod?: boolean; ac_cap_dexmod?: number | null; grants_stealth_disadvantage?: boolean } | null
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

/** To normalize parenthesis in equipment data and item value such as Arrows (20) = 20 pcs of arrows */
const strip = (s: string) => s.replace(/\([^/)]*\)/g, '')
const itemKey = (s: string) => strip(s).toLowerCase().replace(/[^a-z0-9]/g, '')

/** To fix inverted names found in data. */
const itemTokens = (s: string) => [...strip(s).toLowerCase().matchAll(/[a-z0-9]+/g)].map((m) => m[0]).sort().join(' ')

const CAT_IDS: Record<string, string> = {
  holysymbol: '^srd-2024_holy-symbol-',
  druidicfocus: '^srd-2024_druidic-focus-',
  musicalinstrument: '^srd-2024_musical-instrument-',
  gamingset: '^srd-2024_gaming-set-',
}

// RACE

function sizes(desc: string): Size[] {
  const found = [...desc.matchAll(/\b(Small|Medium)\b/g)].map((m) => m[1] as Size)
  const unique = [...new Set(found)]
  return unique.length > 0 ? unique : ['Medium']
}

const RACE_STAT_TRAITS = new Set(['Size', 'Speed', 'Darkvision'])

const feet = (desc: string) => {
  const found = desc.match(/(\d+)\s*feet/i)?.[1]
  return found ? Number(found) : null
}

function heightHints(desc: string): Partial<Record<Size, string>> {
  const hints: Partial<Record<Size, string>> = {}
  for (const match of desc.matchAll(/\b(Small|Medium)\b\s*\(([^)]+)\)/g)) {
    hints[match[1] as Size] = match[2].trim()
  }
  return hints
}

export function toRace(record: Envelope<RawRace>): Race {
  const sizeTrait = trait(record.data.traits, 'Size')

  return {
    id: record.key,
    name: record.name,
    sizes: sizes(sizeTrait),
    heightHints: heightHints(sizeTrait),
    speed: feet(trait(record.data.traits, 'Speed')) ?? 30,
    darkvisionFt: feet(trait(record.data.traits, 'Darkvision')),
    traits: record.data.traits
      .filter((entry) => !RACE_STAT_TRAITS.has(entry.name))
      .map((entry) => ({ name: entry.name, desc: entry.desc.trim() })),
  }
}

// CLASS

function classTableAtLevel1(features: RawClass['features'], column: string): number {
  const rows = features.find((f) => f.name === column)?.data_for_class_table ?? []
  const value = Number(rows.find((row) => row.level === 1)?.column_value)
  return Number.isFinite(value) ? value : 0
}

function featureLevel(features: RawClass['features'], name: string): number | null {
  const levels= (features.find((feature) => feature.name === name)?.gained_at ?? [])
    .map((entry) => entry.level)
    .filter((level): level is number => typeof level === 'number')
  return levels.length > 0 ? Math.min(...levels) : null
}

export function toClass(record: Envelope<RawClass>, equipment: Equipment[]): CharacterClass {
  const choices = CLASS_SKILL_CHOICES[classKey(record.key)] ?? { count: 2, from: 'any' as const }

  return {
    id: record.key,
    name: record.name,
    hitDie: Number(record.data.hit_dice.replace(/^d/i, '')),
    primaryAbilityText: coreTraitRow(record.data.features, 'Primary Ability').trim(),
    primaryAbilities: [],
    savingThrows: savingThrows(record.data),
    fightingStyleAt: featureLevel(record.data.features, 'Fighting Style'),
    features: levelOneFeatures(record.data.features),
    proficiencies: {
      armor: coreTraitRow(record.data.features, 'Armor Training'),
      weapons: coreTraitRow(record.data.features, 'Weapon Proficiencies'),
      skills: coreTraitRow(record.data.features, 'Skill Proficiencies'),
    },
    skillChoices: choices,
    expertiseAt: featureLevel(record.data.features, 'Expertise'),
    casterType: record.data.caster_type ?? 'NONE',
    spellCounts: {
      cantrips: classTableAtLevel1(record.data.features, 'Cantrips'),
      prepared: classTableAtLevel1(record.data.features, 'Prepared Spells'),
    },
    spellSlots:
      classTableAtLevel1(record.data.features, '1st') ||
      classTableAtLevel1(record.data.features, 'Spell Slots'),
    startingEquipment: parseStartingEquipment(coreTraitRow(record.data.features, 'Starting Equipment'), equipment),
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

export function toBackground(record: Envelope<RawBackground>, equipment: Equipment[]): Background {
  const proficiencies = record.data.benefits.find(
    (benefit) => benefit.type === 'skill_proficiency',
  )

  return {
    id: record.key,
    name: record.name,
    skillIds: skillIdsFromNames(proficiencies?.desc ?? ''),
    initiateClassNames: initiateClassNames(record.data.benefits),
    abilityOptions: abilityOptions(record.data.benefits),
    featName: featName(record.data.benefits),
    tool: backgroundTool(record.data.benefits, equipment),
    startingEquipment: parseStartingEquipment(
      record.data.benefits.find((b) => b.type === 'equipment')?.desc ?? '', equipment)
  }
}

/** "Choose one kind of Gaming set" is a category; anything else is a fixed tool that should resolve to a real item.
 * The four gaming sets exists as ``srd-2024_gaming-set-dice and friends, so the category is key prefix. */
const backgroundTool = (benefits: RawBackground['benefits'], equipment: Equipment[]) =>
  resolverGrant((benefits.find((b) => b.type === 'tool_proficiency')?.desc ?? '').trim(), equipment)

const featName = (benefits: RawBackground['benefits']) => benefits.find((ben) => ben.type === 'feat')?.desc?.trim() ?? ''

// ATTRIBUTES

const ABILITY_WORDS = /Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma/g

function savingThrows(record: RawClass): Ability[] {
  const row = coreTraitRow(record.features, 'Saving Throw Proficiency')
  const fromTable = (row.match(ABILITY_WORDS) ?? [])
    .map((word) => ABILITY_BY_NAME[word.toLowerCase()])
    .filter((ability): ability is Ability => ability !== undefined)

  if (fromTable.length > 0) return fromTable

  return record.saving_throws
    .map((entry) => ABILITY_BY_NAME[entry.name.toLowerCase()])
    .filter((ability): ability is Ability => ability !== undefined)
}

const FEATURES_AS_CONTROLS = new Set(['Fighting Style'])

function levelOneFeatures(features: RawClass['features']): ClassFeature[] {
  return features
    .filter((feat) => (feat.gained_at ?? []).some((entry) => entry.level === 1))
    .filter((feat) => (feat.desc ?? '').length > 40)
    .filter((feat) => !FEATURES_AS_CONTROLS.has(feat.name))
    .map((feat) => ({ name: feat.name, desc: feat.desc.trim() }))
}

// EQUIPMENT

function resolverGrant(text: string, equipment: Equipment[]): EquipmentGrant {
  const quantity = Number(text.match(/^(\d+)\s/)?.[1] ?? 1)
  const bare = text.replace(/^\s*\d+\s*/, '')
  const key = itemKey(bare)

  const byKey = [key, key.replace(/es$/, ''), key.replace(/s$/, '')]
    .map((k) => equipment.find((eq) => itemKey(eq.name) === k))
    .find(Boolean)

  const found = byKey ?? equipment.find((eq) => itemTokens(eq.name) === itemTokens(bare))

  if (found) {
    // "Arrows (20)" already is twenty, so 20 Arrows is one of them
    const bundled = Number(found.name.match(/\((\d+)\)/)?.[1] ?? 0)
    return { text, quantity: bundled === quantity ? 1 : quantity, itemId: found.id, choosableFrom: null }
  }

  const category = Object.entries(CAT_IDS).find(([name]) => key.includes(name))
  return { text, quantity, itemId: null, choosableFrom: category?.[1] ?? null }
}

export function parseStartingEquipment(text: string, equipment: Equipment[]): EquipmentOption[] {
  const body = text.replace(/^\**Choose[^:]*\**/i, '').trim()

  return [...body.matchAll(/\(([A-Z])\)\s*([^;]*)/g)].map(([, key, raw]) => {
    const label = raw.replace(/^or\s+/i, '').trim().replace(/[.,;]$/, '')
    const goldCp = gpToCp(Number(label.match(/(\d+)\s*GP/i)?.[1] ?? 0))

    const grants = label
      .split(',')
      .map((entry) => entry.replace(/\band\b/gi, '').trim())
      .filter((entry) => entry && !/^\d+\s*GP$/i.test(entry))
      .map((entry) => resolverGrant(entry, equipment))

    return { key, label, grants, goldCp }
  })
}

function coreTraitRow(features: RawClass['features'], label: string): string {
  for (const feature of features) {
    const row = (feature.desc ?? '').match(new RegExp(`\\|${label}\\|([^|]*)\\|`))
    if (row) return row[1].trim()
  }
  return ''
}

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
    costCp: parseCostCp(record.data.cost),
    armor:
      armor?.ac_base === undefined
        ? undefined
        : {
          base: armor.ac_base,
          addDex: armor.ac_add_dexmod ?? false,
          capDex: armor.ac_cap_dexmod ?? null,
          stealthDisadvantage: armor.grants_stealth_disadvantage ?? false,
        }
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