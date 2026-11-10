import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPanel } from "../components/SearchPanel";
import { seedTestCatalog } from "./fixtures";
import type { Envelope } from "../lib/api";

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))

const envelope = (type: string, key: string, name: string, data: unknown): Envelope<unknown> => ({
  type,
  key,
  name,
  document: 'srd-2024',
  data,
})

const pageOf = (result: Envelope<unknown>[]) => ({
  total: result.length,
  counts: {},
  'num items on page': result.length,
  result,
})

function stubSearch(records: Envelope<unknown>[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(pageOf(records)), { status: 200 }))),
  )
}

/** Types enough to search, then opens the named row. Every detail view is reached this way,
 * through the panel, so a view that throws shows up as a degraded row rather than passing. */
async function open(records: Envelope<unknown>[], rowName: RegExp) {
  stubSearch(records)
  render(<SearchPanel onClose={vi.fn()} />)

  await userEvent.type(screen.getByRole('searchbox'), 'aaa')
  await userEvent.click(await screen.findByRole('button', { name: rowName }))

  return within(screen.getByRole('region'))
}

const DWARF = envelope('race', 'srd-2024_dwarf', 'Dwarf', {
  subspecies_of: null,
  traits: [
    { name: 'Size', desc: 'You are Medium (about 4-5 feet tall) or Small (about 3 feet tall).' },
    { name: 'Speed', desc: 'Your base walking speed is 25 feet.' },
    { name: 'Darkvision', desc: 'You have Darkvision with a range of 120 feet.' },
    { name: 'Stonecunning', desc: 'You gain *Tremorsense* for 10 minutes.' },
  ],
})

const HUMAN = envelope('race', 'srd-2024_human', 'Human', {
  subspecies_of: null,
  traits: [
    { name: 'Size', desc: 'You are Medium.' },
    { name: 'Speed', desc: 'Your base walking speed is 30 feet.' },
  ],
})

const LONGSWORD = envelope('equipment', 'srd-2024_longsword', 'Longsword', {
  category: { key: 'weapon', name: 'Weapon' },
  desc: 'A versatile blade.',
  weapon: { damage_dice: '1d8' },
  cost: '15.00',
  armor: null,
})

const CHAIN_MAIL = envelope('equipment', 'srd-2024_chain-mail', 'Chain Mail', {
  category: { key: 'armor', name: 'Armor' },
  desc: '',
  weapon: null,
  cost: '75.00',
  armor: { ac_base: 16, ac_add_dexmod: false, ac_cap_dexmod: null, grants_stealth_disadvantage: true },
})

const TORCH = envelope('equipment', 'srd-2024_torch', 'Torch', {
  category: { key: 'adventuring-gear', name: 'Adventuring Gear' },
  desc: 'It burns.',
  weapon: null,
  cost: '0.00',
  armor: null,
})

const FIRE_BOLT = envelope('spell', 'srd-2024_fire-bolt', 'Fire Bolt', {
  level: 0,
  school: { name: 'Evocation', key: 'evocation' },
  classes: [{ name: 'Wizard', key: 'srd-2024_wizard' }],
  desc: 'You hurl a mote of fire.',
  concentration: false,
  ritual: false,
  casting_time: 'action',
  range_text: '120 feet',
  duration: 'instantaneous',
})

const DETECT_MAGIC = envelope('spell', 'srd-2024_detect-magic', 'Detect Magic', {
  level: 1,
  school: { name: 'Divination', key: 'divination' },
  classes: [],
  desc: 'You sense the presence of magic.',
  concentration: true,
  ritual: true,
  casting_time: 'action',
  range_text: 'Self',
  duration: '10 minutes',
})

const ACOLYTE = envelope('background', 'srd-2024_acolyte', 'Acolyte', {
  benefits: [
    { name: 'Ability Scores', type: 'ability_score', desc: 'Intelligence, Wisdom, Charisma' },
    { name: 'Skill Proficiencies', type: 'skill_proficiency', desc: 'Insight, Religion' },
    { name: 'Tool Proficiency', type: 'tool_proficiency', desc: "Calligrapher's Supplies" },
    { name: 'Feat', type: 'feat', desc: 'Magic Initiate (Cleric)' },
  ],
})

const STEALTH = envelope('skill', 'stealth', 'Stealth', { ability: 'dex' })

beforeAll(seedTestCatalog)

beforeEach(() => {
  vi.unstubAllGlobals()
  // CI has no .env.local, so the service url has to come from the test itself.
  vi.stubEnv('VITE_API_BASE_URL', 'http://content.test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('reading a race (US-24, FR-9)', () => {
  it('lists every size the species can be, with the speed and darkvision', async () => {
    const detail = await open([DWARF], /^Dwarf/)

    expect(detail.getByText('Size').nextSibling).toHaveTextContent('Medium or Small')
    expect(detail.getByText('Speed').nextSibling).toHaveTextContent('25 feet')
    expect(detail.getByText('Darkvision').nextSibling).toHaveTextContent('120 feet')
  })

  it('says None rather than leaving darkvision blank for a species without it', async () => {
    const detail = await open([HUMAN], /^Human/)

    expect(detail.getByText('Darkvision').nextSibling).toHaveTextContent('None')
  })

  it('shows the real traits and not the rows it already read as stats', async () => {
    const detail = await open([DWARF], /^Dwarf/)

    expect(detail.getByText('Stonecunning')).toBeInTheDocument()
    expect(detail.getByText('Tremorsense').tagName).toBe('EM')
    expect(detail.queryByText('You are Medium (about 4-5 feet tall) or Small (about 3 feet tall).'))
      .not.toBeInTheDocument()
  })
})

describe('reading a piece of equipment (US-24, FR-9)', () => {
  it('prices the item in coins and leaves out the armor row', async () => {
    const detail = await open([LONGSWORD], /^Longsword/)

    expect(detail.getByText('Category').nextSibling).toHaveTextContent('weapon')
    expect(detail.getByText('Cost').nextSibling).toHaveTextContent('15 GP')
    expect(detail.queryByText('Base AC')).not.toBeInTheDocument()
    expect(detail.getByText('A versatile blade.')).toBeInTheDocument()
  })

  it('shows the base armor class for a suit of armor', async () => {
    const detail = await open([CHAIN_MAIL], /^Chain Mail/)

    expect(detail.getByText('Base AC').nextSibling).toHaveTextContent('16')
  })

  it('says no listed price rather than printing 0 GP', async () => {
    const detail = await open([TORCH], /^Torch/)

    expect(detail.getByText('Cost').nextSibling).toHaveTextContent('No listed price')
  })
})

describe('reading a spell (US-24, FR-9)', () => {
  it('calls a level 0 spell a cantrip rather than Level 0', async () => {
    const detail = await open([FIRE_BOLT], /^Fire Bolt/)

    expect(detail.getByText('Level').nextSibling).toHaveTextContent('Cantrip')
    expect(detail.getByText('School').nextSibling).toHaveTextContent('Evocation')
    expect(detail.getByText('Casting time').nextSibling).toHaveTextContent('action')
    expect(detail.getByText('Range').nextSibling).toHaveTextContent('120 feet')
    expect(detail.getByText('Duration').nextSibling).toHaveTextContent('instantaneous')
  })

  it('leaves out the tag row for a spell that is neither concentration nor ritual', async () => {
    const detail = await open([FIRE_BOLT], /^Fire Bolt/)

    expect(detail.queryByText('Tags')).not.toBeInTheDocument()
  })

  it('names both tags for a spell that is concentration and ritual', async () => {
    const detail = await open([DETECT_MAGIC], /^Detect Magic/)

    expect(detail.getByText('Level').nextSibling).toHaveTextContent('Level 1')
    expect(detail.getByText('Tags').nextSibling).toHaveTextContent('Concentration, Ritual')
  })
})

describe('reading a background and a skill (US-24, FR-9)', () => {
  it('resolves the granted skills, ability options, feat and tool', async () => {
    const detail = await open([ACOLYTE], /^Acolyte/)

    expect(detail.getByText('Skills').nextSibling).toHaveTextContent('insight, religion')
    expect(detail.getByText('Ability scores').nextSibling).toHaveTextContent('INT, WIS, CHA')
    expect(detail.getByText('Feat').nextSibling).toHaveTextContent('Magic Initiate (Cleric)')
    expect(detail.getByText('Tool').nextSibling).toHaveTextContent("Calligrapher's Supplies")
  })

  it('shows the ability a skill is rolled against', async () => {
    const detail = await open([STEALTH], /^Stealth/)

    expect(detail.getByText('Ability').nextSibling).toHaveTextContent('DEX')
  })

  it('shows no fact rows at all for a background the service sent empty', async () => {
    const bare = envelope('background', 'srd-2024_hermit', 'Hermit', { benefits: [] })
    const detail = await open([bare], /^Hermit/)

    expect(detail.queryByText('Skills')).not.toBeInTheDocument()
    expect(detail.queryByText('Feat')).not.toBeInTheDocument()
  })
})

describe('reading a feat, a condition and a magic item (US-24, FR-9)', () => {
  it('lists the benefits of a feat under its lead-in, with no prerequisite as None', async () => {
    const alert = envelope('feat', 'srd-2024_alert', 'Alert', {
      type: 'Origin',
      desc: 'You gain the following benefits.',
      prerequisite: '',
      benefits: [{ desc: 'Initiative Proficiency.' }, { desc: 'Initiative Swap.' }],
    })
    const detail = await open([alert], /^Alert/)

    expect(detail.getByText('Category').nextSibling).toHaveTextContent('Origin')
    expect(detail.getByText('Prerequisite').nextSibling).toHaveTextContent('None')
    expect(detail.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Initiative Proficiency.',
      'Initiative Swap.',
    ])
  })

  it('shows the effects of a condition as a list', async () => {
    const charmed = envelope('condition', 'charmed', 'Charmed', {
      descriptions: [{ desc: 'While Charmed:\n* Can\u2019t Harm the Charmer.\n* Social Advantage.' }],
    })
    const detail = await open([charmed], /^Charmed/)

    expect(detail.getAllByRole('listitem')).toHaveLength(2)
  })

  it('names the rarity and who can attune to a magic item', async () => {
    const wand = envelope('magic_item', 'srd-2024_wand-of-fireballs', 'Wand of Fireballs', {
      desc: 'This wand has 7 charges.',
      category: { name: 'Wand' },
      rarity: { name: 'Rare' },
      requires_attunement: true,
      attunement_detail: 'Requires Attunement by a Spellcaster',
      weapon: null,
      armor: null,
    })
    const detail = await open([wand], /^Wand of Fireballs/)

    expect(detail.getByText('Rarity').nextSibling).toHaveTextContent('Rare')
    expect(detail.getByText('Attunement').nextSibling).toHaveTextContent('Required by a Spellcaster')
    expect(detail.queryByText('Damage')).not.toBeInTheDocument()
  })
})

describe('reading a monster (US-24, FR-9)', () => {
  const WOLF = envelope('monster', 'srd-2024_wolf', 'Wolf', {
    size: { name: 'Medium' },
    type: { name: 'Beast' },
    alignment: 'unaligned',
    armor_class: 12,
    hit_points: 11,
    hit_dice: '2d8 + 2',
    initiative_bonus: 2,
    speed: { walk: 40 },
    ability_scores: { strength: 14, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
    saving_throws: { strength: 2, dexterity: 2, constitution: 1, intelligence: -4, wisdom: 1, charisma: -2 },
    skill_bonuses: { perception: 5, stealth: 4 },
    passive_perception: 15,
    darkvision_range: 60,
    languages: { as_string: '' },
    resistances_and_immunities: null,
    challenge_rating: 0.25,
    experience_points: 50,
    traits: [{ name: 'Pack Tactics', desc: 'The wolf has Advantage on an attack roll against a creature.' }],
    actions: [
      { name: 'Bite', desc: 'Melee Attack Roll: +4.', action_type: 'ACTION', order_in_statblock: 1, usage_limits: null },
    ],
  })

  it('reads the stat block facts', async () => {
    const detail = await open([WOLF], /^Wolf/)

    expect(detail.getByText('Creature').nextSibling).toHaveTextContent('Medium Beast, unaligned')
    expect(detail.getByText('Hit points').nextSibling).toHaveTextContent('11 (2d8 + 2)')
    expect(detail.getByText('Languages').nextSibling).toHaveTextContent('None')
    expect(detail.getByText('Challenge').nextSibling).toHaveTextContent('1/4 (XP 50)')
    expect(detail.queryByText('Immunities')).not.toBeInTheDocument()
  })

  it('tables the ability scores with their modifiers and saves', async () => {
    const detail = await open([WOLF], /^Wolf/)
    const table = within(detail.getByRole('table', { name: 'Ability scores' }))

    expect(table.getByRole('row', { name: /^Score/ })).toHaveTextContent('Score1415123126')
    expect(table.getByRole('row', { name: /^Save/ })).toHaveTextContent('Save+2+2+1\u22124+1\u22122')
  })

  it('lists traits and actions under their own headings', async () => {
    const detail = await open([WOLF], /^Wolf/)

    expect(detail.getByText('Traits')).toBeInTheDocument()
    expect(detail.getByText('Pack Tactics')).toBeInTheDocument()
    expect(detail.getByText('Actions')).toBeInTheDocument()
    expect(detail.getByText('Bite')).toBeInTheDocument()
  })
})

describe('a content type with no detail view yet (FR-11)', () => {
  it('says so for a type it has never heard of rather than rendering an empty panel', async () => {
    const detail = await open([envelope('vehicle', 'srd-2024_rowboat', 'Rowboat', {})], /^Rowboat/)

    expect(detail.getByText(/no detail view for a vehicle yet/)).toBeInTheDocument()
  })

  it('reads the underscore in a type name as a word break', async () => {
    const detail = await open(
      [envelope('spell_list', 'srd-2024_wizard', 'Wizard Spell List', {})],
      /^Wizard Spell List/,
    )

    expect(detail.getByText(/no detail view for a spell list yet/)).toBeInTheDocument()
  })

  it('degrades a record it cannot read instead of taking the list down', async () => {
    // A class record with no features at all -- toClass reads them, so the conversion throws.
    const broken = envelope('class', 'srd-2024_broken', 'Broken Class', { subclass_of: null })
    const detail = await open([broken, STEALTH], /^Broken Class/)

    expect(detail.getByText(/no detail view for a class yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Stealth/ })).toBeInTheDocument()
  })
})

describe('before a result is chosen', () => {
  it('invites the reader to pick one', async () => {
    stubSearch([STEALTH])
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'aaa')

    expect(await screen.findByText('Pick a result to read it.')).toBeInTheDocument()
  })
})
