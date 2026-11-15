import { describe, expect, it } from "vitest";
import { toCond, toFeat, toMagicItem, toMonster } from "../data/reference";
import type { RawCond, RawFeat, RawMagicItem, RawMonster } from "../data/reference";
import type { Envelope } from "../lib/api";

const envelope = <T>(type: string, key: string, name: string, data: T): Envelope<T> => ({
  type,
  key,
  name,
  document: 'srd-2024',
  data,
})

/** Trimmed from the service's Aboleth, actions sent out of statblock order as the service does. */
const ABOLETH: RawMonster = {
  size: { name: 'Large' },
  type: { name: 'Aberration' },
  alignment: 'lawful evil',
  armor_class: 17,
  hit_points: 150,
  hit_dice: '20d10 + 40',
  initiative_bonus: 7,
  speed: { walk: 10, swim: 40 },
  ability_scores: { strength: 21, dexterity: 9, constitution: 15, intelligence: 18, wisdom: 15, charisma: 18 },
  saving_throws: { strength: 5, dexterity: 3, constitution: 6, intelligence: 8, wisdom: 6, charisma: 4 },
  skill_bonuses: { history: 12, perception: 10 },
  passive_perception: 20,
  blindsight_range: null,
  darkvision_range: 120,
  tremorsense_range: null,
  truesight_range: null,
  languages: { as_string: 'Deep Speech; telepathy 120 ft.' },
  resistances_and_immunities: { damage_immunities_display: '', condition_immunities_display: '' },
  challenge_rating: 10,
  experience_points: 5900,
  traits: [{ name: 'Amphibious', desc: 'The aboleth can breathe air and water.' }],
  actions: [
    { name: 'Tentacle', desc: 'Melee Attack Roll: +9.', action_type: 'ACTION', order_in_statblock: 2, usage_limits: null },
    { name: 'Lash', desc: 'One Tentacle attack.', action_type: 'LEGENDARY_ACTION', order_in_statblock: 4, usage_limits: null },
    { name: 'Multiattack', desc: 'Two Tentacle attacks.', action_type: 'ACTION', order_in_statblock: 1, usage_limits: null },
    {
      name: 'Dominate Mind',
      desc: 'Wisdom Saving Throw: DC 16.',
      action_type: 'ACTION',
      order_in_statblock: 3,
      usage_limits: { type: 'PER_DAY', param: 2 },
    },
  ],
}

const monster = (overrides: Partial<RawMonster> = {}) =>
  toMonster(envelope('monster', 'srd-2024_aboleth', 'Aboleth', { ...ABOLETH, ...overrides }))

describe('toMonster', () => {
  it('reads the top of the stat block', () => {
    const aboleth = monster()

    expect(aboleth.creature).toBe('Large Aberration, lawful evil')
    expect(aboleth.armorClass).toBe(17)
    expect(aboleth.hitPoints).toBe('150 (20d10 + 40)')
    expect(aboleth.initiative).toBe('+7 (17)')
    expect(aboleth.speed).toBe('10 ft., Swim 40 ft.')
    expect(aboleth.senses).toBe('Darkvision 120 ft., Passive Perception 20')
    expect(aboleth.skills).toBe('History +12, Perception +10')
    expect(aboleth.challenge).toBe('10 (XP 5,900)')
  })

  it('works out each modifier and takes the save the service sends', () => {
    const dex = monster().scores.find((row) => row.ability === 'DEX')

    expect(dex).toEqual({ ability: 'DEX', score: 9, modifier: -1, save: 3 })
  })

  it('groups the actions under their headings, in statblock order', () => {
    const blocks = monster().blocks

    expect(blocks.map((block) => block.title)).toEqual(['Traits', 'Actions', 'Legendary actions'])
    expect(blocks[1].entries.map((entry) => entry.name)).toEqual(['Multiattack', 'Tentacle', 'Dominate Mind (2/Day)'])
  })

  it('names a recharge, unless the action name already carries it', () => {
    const breath = { desc: '', action_type: 'ACTION', order_in_statblock: 1 }
    const blocks = monster({
      actions: [
        { ...breath, name: 'Poison Breath', usage_limits: { type: 'RECHARGE_ON_ROLL', param: 5 } },
        { ...breath, name: 'Petrifying Gaze (Recharge 4-6)', usage_limits: { type: 'RECHARGE', param: 4 } },
      ],
    }).blocks

    expect(blocks[1].entries.map((entry) => entry.name)).toEqual([
      'Poison Breath (Recharge 5–6)',
      'Petrifying Gaze (Recharge 4-6)',
    ])
  })

  it('writes a fractional challenge rating as a fraction', () => {
    expect(monster({ challenge_rating: 0.25, experience_points: 50 }).challenge).toBe('1/4 (XP 50)')
  })

  it('notes a hovering flyer', () => {
    expect(monster({ speed: { walk: 30, fly: 60, hover: true } }).speed).toBe('30 ft., Fly 60 ft. (hover)')
  })

  it('puts damage and condition immunities in one row, the way the 2024 stat block does', () => {
    const immune = monster({
      resistances_and_immunities: { damage_immunities_display: 'poison', condition_immunities_display: 'poisoned' },
    })

    expect(immune.immunities).toBe('poison; poisoned')
  })

  it('throws on a record with no ability scores, so search shows it as a plain row', () => {
    expect(() => monster({ ability_scores: null })).toThrow(/strength/)
  })
})

describe('toFeat', () => {
  const ALERT: RawFeat = {
    type: 'Origin',
    desc: 'You gain the following benefits.',
    prerequisite: '',
    benefits: [{ desc: 'Initiative Proficiency.' }, { desc: 'Initiative Swap.' }],
  }

  it('keeps the category, prerequisite and each benefit', () => {
    const alert = toFeat(envelope('feat', 'srd-2024_alert', 'Alert', ALERT))

    expect(alert.category).toBe('Origin')
    expect(alert.prerequisite).toBe('')
    expect(alert.benefits).toEqual(['Initiative Proficiency.', 'Initiative Swap.'])
  })

  it('throws on a record with no benefits', () => {
    expect(() => toFeat(envelope('feat', 'srd-2024_alert', 'Alert', { ...ALERT, benefits: null }))).toThrow()
  })
})

describe('toCond', () => {
  it('keeps the description', () => {
    const data: RawCond = { descriptions: [{ desc: 'You can only crawl.' }] }

    expect(toCond(envelope('condition', 'prone', 'Prone', data)).desc).toBe('You can only crawl.')
  })

  it('throws on a record with no description', () => {
    expect(() => toCond(envelope('condition', 'prone', 'Prone', { descriptions: [] }))).toThrow()
  })
})

describe('toMagicItem', () => {
  const WAND: RawMagicItem = {
    desc: 'This wand has 7 charges.',
    category: { name: 'Wand' },
    rarity: { name: 'Rare' },
    requires_attunement: true,
    attunement_detail: 'Requires Attunement by a Spellcaster',
    weapon: null,
    armor: null,
  }
  const item = (data: Partial<RawMagicItem>) =>
    toMagicItem(envelope('magic_item', 'srd-2024_wand', 'Wand', { ...WAND, ...data }))

  it('shortens the attunement detail, since the row already says Attunement', () => {
    expect(item({}).attunement).toBe('Required by a Spellcaster')
    expect(item({ attunement_detail: null }).attunement).toBe('Required')
    expect(item({ requires_attunement: false }).attunement).toBe('')
  })

  it('reads the damage of a magic weapon and the armor class of magic armor', () => {
    const axe = item({ weapon: { damage_dice: '1d8', damage_type: { name: 'Slashing' } } })
    const plate = item({ armor: { ac_display: '14 + Dex modifier (max 2)' } })

    expect(axe.damage).toBe('1d8 slashing')
    expect(plate.armorClass).toBe('14 + Dex modifier (max 2)')
  })

  it('throws on a record with no rarity', () => {
    expect(() => item({ rarity: null })).toThrow()
  })
})
