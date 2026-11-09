/** Content the search panel shows but a char never uses: feats, conditions, magic items, and monsters.
 * Each normalizer keeps what its detail view prints, and throws on a record missing its core fields
 * -- /search turns that into a plain row rather than an empty view. */

import type { Ability } from "../characters/character";
import { ABILITIES, abilityModifier, formatModifier } from "../characters/abilities";
import type { Envelope } from "../lib/api";

// FEATS

export type RawFeat = {
  type: string | null
  desc: string | null
  prerequisite: string | null
  benefits: { desc: string }[] | null
}

export type Feat = {
  id: string
  name: string
  category: string
  prerequisite: string
  desc: string
  benefits: string[]
}

export function toFeat(record: Envelope<RawFeat>): Feat {
  const { benefits } = record.data
  if (!Array.isArray(benefits)) throw new Error(`feat ${record.key} has no benefits`)
  
  return {
    id: record.key,
    name: record.name,
    category: record.data.type ?? '',
    prerequisite: record.data.prerequisite ?? '',
    desc: record.data.desc ?? '',
    benefits: benefits.map((ben) => ben.desc),
  }
}

// CONDITION

export type RawCond = { descriptions: { desc: string }[] | null }

export type Condition = { id: string; name: string; desc: string }

export function toCond(record: Envelope<RawCond>): Condition {
  const desc = record.data.descriptions?.[0].desc
  if (!desc) throw new Error(`condition ${record.key} has no description`)

  return { id: record.key, name: record.name, desc }
}

// MAIG ITEMS

export type RawMagicItem = {
  desc: string | null
  category: { name: string } | null
  rarity: { name: string } | null
  requires_attunement: boolean | null
  attunement_detail: string | null
  weapon: { damage_dice?: string; damage_type?: { name: string } | null } | null
  armor: { ac_display?: string } | null
}

export type MagicItem = {
  id: string
  name: string
  category: string
  rarity: string
  attunement: string
  damage: string
  armorClass: string
  desc: string
}

export function toMagicItem(record: Envelope<RawMagicItem>): MagicItem {
  const { category, rarity, weapon, armor } = record.data
  if (!category?.name || !rarity?.name) throw new Error(`magic item ${record.key} has no category or rarity`)

  const attunement = record.data.requires_attunement
    ? (record.data.attunement_detail?.replace(/^Requires Attunement\s*/i, 'Required ') ?? 'Required')
    : ''
  
  return {
    id: record.key,
    name: record.name,
    category: category.name,
    rarity: rarity.name,
    attunement,
    damage: weapon?.damage_dice ? `${weapon.damage_dice} ${weapon.damage_type?.name.toLowerCase() ?? ''}`.trim() : '',
    armorClass: armor?.ac_display ?? '',
    desc: record.data.desc ?? '',
  }
}

// MONSTERS

type RawAction = {
  name: string
  desc: string
  action_type: string | null
  order_in_statblock: number | null
  usage_limits: { type: string; param: number | null } | null
}

type Moves = 'walk' | 'burrow' | 'climb' | 'fly' | 'swim'

export type RawMonster = {
  size: { name: string } | null
  type: { name: string } | null
  alignment: string | null
  armor_class: number
  hit_points: number
  hit_dice: string | null
  initiative_bonus: number | null
  speed: (Partial<Record<Moves, number>> & { hover?: boolean | null }) | null
  ability_scores: Record<string, number> | null
  saving_throws: Record<string, number> | null
  skill_bonuses: Record<string, number> | null
  passive_perception: number | null
  blindsight_range: number | null
  darkvision_range: number | null
  tremorsense_range: number | null
  truesight_range: number | null
  languages: { as_string: string } | null
  resistances_and_immunities: {
    damage_vulnerabilities_display?: string
    damage_resistances_display?: string
    damage_immunities_display?: string
    condition_immunities_display?: string
  } | null
  challenge_rating: number | null
  experience_points: number | null
  traits: { name: string; desc: string }[] | null
  actions: RawAction[] | null
}

export type MonsterScore = { ability: Ability; score: number; modifier: number; save: number }

export type MonsterBlock = { title: string; entries: { name: string; desc: string }[] }

export type Monster = {
  id: string
  name: string
  creature: string
  armorClass: number
  hitPoints: string
  initiative: string
  speed: string
  scores: MonsterScore[]
  skills: string
  vulnerabilities: string
  resistances: string
  immunities: string
  senses: string
  languages: string
  challenge: string
  blocks: MonsterBlock[]
}

const SCORE_FIELD: Record<Ability, string> = {
  STR: 'strength',
  DEX: 'dexterity',
  CON: 'constitution',
  INT: 'intelligence',
  WIS: 'wisdom',
  CHA: 'charisma',
}

const SENSES = [
  ['Blindsight', 'blindsight_range'],
  ['Darkvision', 'darkvision_range'],
  ['Tremorsense', 'tremorsense_range'],
  ['Truesight', 'truesight_range'],
] as const

const MOVES = ['burrow', 'climb', 'fly', 'swim'] as const

const ACTION_BLOCKS = [
  ['ACTION', 'Actions'],
  ['BONUS_ACTION', 'Bonus actions'],
  ['REACTION', 'Reactions'],
  ['LEGENDARY_ACTION', 'Legendary actions'],
] as const

const CR_FRAC: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function speed(raw: RawMonster['speed']): string {
  const moves = raw ?? {}
  const others = MOVES.flatMap((mv) => {
    const feet = moves[mv]
    if (!feet) return []
    return [`${capitalize(mv)} ${feet} ft.${mv === 'fly' && moves.hover ? ' (hover)' : ''}`]
  })
  return [`${moves.walk ?? 0} ft.`, ...others].join(', ')
}

function actionName(action: RawAction): string {
  const limit = action.usage_limits
  if (!limit || limit.param === null || /recharge|\/day/i.test(action.name)) return action.name
  if (limit.type === 'PER_DAY') return `${action.name} (${limit.param}/Day)`
  if (limit.type.startsWith('RECHARGE')) {
    return `${action.name} (Recharge ${limit.param === 6 ? '6' : `${limit.param}\u20136`})`
  }
  return action.name
}

export function toMonster(record: Envelope<RawMonster>): Monster {
  const raw = record.data
  if (typeof raw.armor_class !== 'number' || typeof raw.hit_points !== 'number') {
    throw new Error(`monster ${record.key} has no armor clas or hit points`)
  }

  const scores = ABILITIES.map((ability) => {
    const field = SCORE_FIELD[ability]
    const score = raw.ability_scores?.[field]
    if (typeof score !== 'number') throw new Error(`monster ${record.key} has no ${field} score`)
    const modifier = abilityModifier(score)
    return { ability, score, modifier, save: raw.saving_throws?.[field] ?? modifier } 
  })

  const initiative = raw.initiative_bonus ?? scores[1].modifier
  const defenses = raw.resistances_and_immunities ?? {}
  const cr = raw.challenge_rating
  const actions = [...(raw.actions ?? [])].sort((a, b) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0))

  return {
    id: record.key,
    name: record.name,
    creature: [[raw.size?.name, raw.type?.name].filter(Boolean).join(' '), raw.alignment ?? '']
      .filter(Boolean)
      .join(', '),
    armorClass: raw.armor_class,
    hitPoints: raw.hit_dice ? `${raw.hit_points} (${raw.hit_dice})` : String(raw.hit_points),
    initiative: `${formatModifier(initiative)} (${10 + initiative})`,
    speed: speed(raw.speed),
    scores,
    skills: Object.entries(raw.skill_bonuses ?? {})
      .map(([skill, bonus]) => `${capitalize(skill.replace(/_/g, ' '))} ${formatModifier(bonus)}`)
      .join(', '),
    vulnerabilities: defenses.damage_vulnerabilities_display ?? '',
    resistances: defenses.damage_resistances_display ?? '',
    immunities: [defenses.damage_immunities_display, defenses.condition_immunities_display].filter(Boolean).join('; '),
    senses: [
      ...SENSES.flatMap(([label, field]) => (raw[field] ? [`${label} ${raw[field]} ft`] : [])),
      ...(typeof raw.passive_perception === 'number' ? [`Passive Perception ${raw.passive_perception}`] : []),
    ].join(', '),
    languages: raw.languages?.as_string || 'None',
    challenge: typeof cr !== 'number' ? '' : `${CR_FRAC[cr] ?? cr} (XP ${(raw.experience_points ?? 0).toLocaleString()})`,
    blocks: [
      { title: 'Traits', entries: raw.traits ?? [] },
      ...ACTION_BLOCKS.map(([type, title]) => ({
        title,
        entries: actions
          .filter((action) => action.action_type === type)
          .map((action) => ({ name: actionName(action), desc: action.desc })),
      })),
    ].filter((block) => block.entries.length > 0),
  }
}