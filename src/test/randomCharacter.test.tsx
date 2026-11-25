/** US-39 parity: the generation fixture must also satisfy the real client.

 * Everything here goes through the production normalizers and the production sheet, so a
 * drift in the class metadata contract, in the equipment prose reader, or in the level-one
 * budgets shows up as a failure rather than as a browser surprise.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { STEPS, type Character } from "../characters/character";
import { isComplete, isStepApplicable, isStepValid } from "../characters/progress";
import { CharacterSheet } from "../components/character/CharacterSheet";
import { derived, spellDerived } from "../components/character/sheets";
import {
  getBg,
  getClass,
  seedCatalog,
  spellBudget,
  spellOptions,
  type Catalog,
  type EquipmentPick,
} from "../data/catalog";
import {
  isBaseClass,
  toBackground,
  toClass,
  toEquipment,
  toRace,
  toSkill,
  toSpell,
  type RawBackground,
  type RawClass,
  type RawEquipment,
  type RawRace,
  type RawSkill,
  type RawSpell,
} from "../data/normalize";
import type { Envelope } from "../lib/api";

/** Vendored copy of `forge-backend/tests/fixtures/us39_creation_cases.json`: the two repos
 * check out separately in CI, so this test cannot read across the repo boundary. Re-copy
 * from the backend repo whenever that fixture changes. Resolved from
 * `import.meta.dirname` rather than `new URL(..., import.meta.url)`, which Vite rewrites
 * into a dev-server asset URL. */
const FIXTURE = resolve(
  import.meta.dirname,
  'fixtures/us39_creation_cases.json',
)

const CASES = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  references: Record<string, unknown[]>
  validCharacters: Record<string, Character>
}

const RECORDS = CASES.validCharacters

/** Build the catalog exactly the way `CatalogProvider` does, from the fixture envelopes. */
function fixtureCatalog(): Catalog {
  const { race, class: classes, background, equipment, skill, spell } = CASES.references
  const skillList = (skill as Envelope<RawSkill>[]).map(toSkill)
  const equipmentList = (equipment as Envelope<RawEquipment>[]).map(toEquipment)

  return {
    skills: skillList,
    equipment: equipmentList,
    races: (race as Envelope<RawRace>[]).map(toRace),
    classes: (classes as Envelope<RawClass>[]).filter(isBaseClass).map((r) => toClass(r, equipmentList)),
    backgrounds: (background as Envelope<RawBackground>[]).map((r) =>
      toBackground(r, equipmentList, skillList),
    ),
    spells: (spell as Envelope<RawSpell>[]).map(toSpell),
    sources: [],
  }
}

beforeAll(() => seedCatalog(fixtureCatalog()))

const texts = (elements: Iterable<Element>) => [...elements].map((element) => element.textContent)

function openSheet(character: Character) {
  render(
    <CharacterSheet
      character={character}
      playerName="Paul De Silos"
      mode="random-review"
      onClose={vi.fn()}
      onKeep={vi.fn(async () => {})}
    />,
  )
  return screen.getByRole('dialog', { name: character.name })
}

const box = (caption: string) => screen.getByRole('heading', { name: caption }).parentElement!

describe('the shared generation fixture, read by the client (ST-47, ST-48)', () => {
  it('normalizes the seeded class metadata without a copied table', () => {
    const catalog = fixtureCatalog()

    expect(catalog.races.map((race) => race.id)).toEqual(["srd-2024_human", "srd-2024_dwarf"])
    expect(catalog.classes.map((cls) => cls.id)).not.toContain("srd-2024_champion")
    expect(getClass("srd-2024_fighter")?.fightingStyles.map((style) => style.id)).toEqual([
      "archery", "defense", "dueling", "great-weapon-fighting", "protection",
      "two-weapon-fighting",
    ])
    expect(getClass("srd-2024_paladin")?.fightingStyles).toEqual([])
    expect(getClass("srd-2024_rogue")?.skillChoices).toEqual({
      count: 4,
      from: ["acrobatics", "athletics", "deception", "insight", "intimidation",
             "investigation", "perception", "performance", "persuasion",
             "sleight-of-hand", "stealth"],
    })
  })

  it.each(Object.keys(RECORDS))('%s is complete under the client rules', (name) => {
    const record = RECORDS[name]

    expect(isComplete(record)).toBe(true)
    for (const { id } of STEPS) {
      if (isStepApplicable(id, record)) {
        expect(isStepValid(id, record), `step ${id}`).toBe(true)
      }
    }
  })

  it('reads the class and background equipment prose exactly as the service froze it', () => {
    for (const [name, record] of Object.entries(RECORDS)) {
      const cls = getClass(record.classId)
      const classPick = record.equipmentChoice.class as EquipmentPick
      expect(cls?.startingEquipment.find((option) => option.key === classPick.key), name).toEqual(
        classPick,
      )

      const background = getBg(record.backgroundId)
      const backgroundPick = record.equipmentChoice.background
      expect(backgroundPick, name).not.toBeNull()
      expect(
        background?.startingEquipment.find((option) => option.key === backgroundPick?.key),
        name,
      ).toEqual(backgroundPick)
    }
  })

  it('holds the combined spell budgets the service enforces', () => {
    const wizard = RECORDS.wizard_acolyte
    const wizardClass = getClass(wizard.classId)
    const acolyte = getBg(wizard.backgroundId)

    expect(spellBudget(wizardClass, acolyte)).toEqual({ cantrips: 3, prepared: 2 })
    const options = spellOptions(wizardClass, acolyte).map((spell) => spell.id)
    expect(wizard.spellIds.every((id) => options.includes(id))).toBe(true)

    const fighter = RECORDS.fighter_soldier
    expect(getClass(fighter.classId)?.casterType).toBe('NONE')
    expect(spellOptions(getClass(fighter.classId), getBg(fighter.backgroundId))).toEqual([])
    expect(fighter.spellIds).toEqual([])
  })
})

describe('the review sheet renders a generated record (ST-47)', () => {
  it('marks the review as unsaved and offers keep/discard instead of edit', () => {
    const sheet = openSheet(RECORDS.fighter_soldier)

    expect(within(sheet).getByText('Not saved')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Keep character' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('prints a fighter\'s scores, kit, skills and derived statistics', () => {
    const record = RECORDS.fighter_soldier
    openSheet(record)

    expect(texts(within(screen.getByRole('list', { name: 'Ability scores' })).getAllByRole('listitem')))
      .toEqual([
        'Strength+317', 'Dexterity+214', 'Constitution+214',
        'Intelligence+112', 'Wisdom+010', 'Charisma−18',
      ])

    const d = derived(record)
    expect(d).toMatchObject({
      armorClass: 16, hitPoints: 12, initiative: 2, speed: 30, passivePerception: 12,
    })

    const items = texts(within(box('Equipment')).getAllByRole('list')[1].querySelectorAll('li'))
    expect(items).toEqual(expect.arrayContaining(['Chain Mail', 'Javelin ×8', 'Arrows (20)', 'Gaming Set, Dice']))
    // The class kit's own gold plus the background kit's, and nothing spent yet.
    expect(texts(within(screen.getByRole('list', { name: 'Coins' })).getAllByRole('listitem')))
      .toEqual(['CP0', 'SP0', 'EP', 'GP18', 'PP'])

    expect(texts([...box('Other proficiencies & languages').querySelectorAll('p')])).toContain(
      'Tools. Gaming Set, Dice',
    )
    // Proficient skills carry their marker and their proficiency bonus.
    const skill = (name: string) => within(box('Skills')).getByText(name).closest('li')!
    expect(within(skill('Perception')).getByRole('img', { name: 'Proficient' })).toBeInTheDocument()
    expect(within(skill('Stealth')).queryByRole('img')).not.toBeInTheDocument()
  })

  it('prints a caster\'s spells and casting profile', () => {
    const record = RECORDS.wizard_acolyte
    openSheet(record)

    expect(spellDerived(record)).toEqual({
      ability: 'INT', abilityModifier: 3, saveDC: 13, attackBonus: 5, slots: 2,
    })

    const page = within(screen.getByRole('article', { name: 'Spellcasting' }))
    const field = (label: string) => page.getByText(label).previousSibling?.textContent
    expect(field('Spellcasting class')).toBe('Wizard')
    expect(field('Spell save DC')).toBe('13')
    expect(field('Spell attack bonus')).toBe('+5')

    const named = (region: string) =>
      texts(within(screen.getByRole('region', { name: region })).getAllByRole('listitem')).filter(Boolean)
    expect(named('Cantrips')).toEqual(['Fire Bolt', 'Guidance', 'Light'])
    expect(named('Level 1 spells')).toEqual(['Bless', 'Mage Armor'])
  })

  it('renders a background-only caster carrying a gold-only class kit', () => {
    const record = RECORDS.fighter_acolyte
    openSheet(record)

    expect(spellDerived(record)).toEqual({
      ability: 'WIS', abilityModifier: 0, saveDC: 10, attackBonus: 2, slots: 0,
    })
    // Fighter A/B/C exist but this record took the gold-only option, and its background
    // took the gold-only option too, so the kit is empty and the purse holds both grants.
    expect(record.equipmentChoice.class?.grants).toEqual([])
    expect(record.equipmentChoice.background?.grants).toEqual([])
    expect(within(box('Equipment')).getAllByRole('list')[1]).toBeEmptyDOMElement()
    expect(texts(within(screen.getByRole('list', { name: 'Coins' })).getAllByRole('listitem')))
      .toEqual(['CP0', 'SP0', 'EP', 'GP205', 'PP'])
  })

  it('prints gear the seed does not carry as its own text, and marks expertise', () => {
    const record = RECORDS.rogue_acolyte
    openSheet(record)

    const items = texts(within(box('Equipment')).getAllByRole('list')[1].querySelectorAll('li'))
    expect(items).toEqual(expect.arrayContaining(["Calligrapher's Supplies", 'Book (prayers)']))

    const skill = (name: string) => within(box('Skills')).getByText(name).closest('li')!
    expect(within(skill('Athletics')).getByRole('img', { name: 'Expertise' })).toBeInTheDocument()
    // Religion is a background grant rather than a class pick, and still takes expertise.
    expect(within(skill('Religion')).getByRole('img', { name: 'Expertise' })).toBeInTheDocument()
    expect(within(skill('Stealth')).queryByRole('img')).not.toBeInTheDocument()
  })
})
