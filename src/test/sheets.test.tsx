import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDraft } from "../characters/character";
import type { Ability, Character } from "../characters/character";
import { derived, spellDerived } from "../components/character/sheets";
import { ClassStep, RaceStep } from "../components/character/steps";
import { Markdown } from "../components/Markdown";
import { toClass } from "../data/normalize";
import type { RawClass } from "../data/normalize";
import type { Envelope } from "../lib/api";
import { seedTestCatalog } from "./fixtures";

beforeAll(seedTestCatalog)

type Spread = Partial<Record<Ability, number>>

/** A Human Fighter by default - the two fixtures carrying full trait and feature data. */
function character(overrides: Partial<Character> = {}): Character {
  return {
    ...createDraft(),
    raceId: 'srd-2024_human',
    classId: 'srd-2024_fighter',
    ...overrides,
  }
}

/** createDraft fixes level at 1, so the proficiency bonus is +2 throughout. */
const scores = (c: Character, base: Spread, originBonuses: Spread = {}): Character => ({
  ...c,
  abilities: { ...c.abilities, base, originBonuses },
})

describe('saving throws and proficiency (UT-64)', () => {
  it('adds the proficiency bonus to the two saves the class grants and to no others', () => {
    const fighter = scores(
      character(),
      { STR: 14, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      { INT: 2, WIS: 1 },
    )
    const d = derived(fighter)

    expect(d.proficiencyBonus).toBe(2)
    // Fighter is proficient in STR and CON; origin bonuses land before the modifier.
    expect(d.savingThrows).toEqual([
      { ability: 'STR', modifier: 4, proficient: true },
      { ability: 'DEX', modifier: 2, proficient: false },
      { ability: 'CON', modifier: 3, proficient: true },
      { ability: 'INT', modifier: 2, proficient: false },
      { ability: 'WIS', modifier: 0, proficient: false },
      { ability: 'CHA', modifier: -1, proficient: false },
    ])
  })

  it('reports only the abilities that carry a score, so the sheet can print an em dash', () => {
    const d = derived(scores(character(), { STR: 15, CON: 14 }))

    expect(d.savingThrows.map((save) => save.ability)).toEqual(['STR', 'CON'])
  })
})

describe('class saving throws read from the features table (UT-65)', () => {
  it('reads the Core Traits row rather than the upstream field', () => {
    const cls = toClass(
      classRecord(
        [coreTrait('|Saving Throw Proficiencies|Dexterity and Intelligence|')],
        [{ name: 'strength' }, { name: 'constitution' }],
      ),
      [],
    )

    expect(cls.savingThrows).toEqual(['DEX', 'INT'])
  })

  it('falls back to the upstream field when the class has no such row', () => {
    const cls = toClass(classRecord([], [{ name: 'strength' }, { name: 'constitution' }]), [])

    expect(cls.savingThrows).toEqual(['STR', 'CON'])
  })

  it('drops a word that names no ability rather than emitting undefined', () => {
    const cls = toClass(
      classRecord([coreTrait('|Saving Throw Proficiencies|Fortitude and Wisdom|')], []),
      [],
    )

    expect(cls.savingThrows).toEqual(['WIS'])
  })
})

describe('spellcasting profile (UT-60, UT-61)', () => {
  it('derives ability, save DC, attack bonus and slots for a full caster', () => {
    const wizard = scores(character({ classId: 'srd-2024_wizard' }), { INT: 14 }, { INT: 2 })

    // DC is 8 + 2 (proficiency) + 3 (INT 14 base + 2 origin).
    expect(spellDerived(wizard)).toEqual({
      ability: 'INT',
      abilityModifier: 3,
      saveDC: 13,
      attackBonus: 5,
      slots: 2,
    })
  })

  it('leaves a non-caster with no profile, even with a high Intelligence', () => {
    const fighter = scores(character({ backgroundId: 'srd-2024_soldier' }), { INT: 16, CON: 14 })
    const spells = spellDerived(fighter)

    // Soldier grants Savage Attacker, not Magic Initiate, so nothing opens the caster path.
    expect(spells.slots).toBe(0)
    expect(spells.ability).toBeUndefined()
    expect(spells.abilityModifier).toBeUndefined()
    expect(spells.saveDC).toBeUndefined()
    expect(spells.attackBonus).toBeUndefined()
  })
})

describe('initiative, speed and size (UT-69)', () => {
  it('takes initiative from Dexterity, and speed and size from the race', () => {
    const d = derived(scores(character({ raceId: 'srd-2024_dwarf' }), { DEX: 14 }))

    expect(d.initiative).toBe(2)
    expect(d.speed).toBe(30)
    expect(d.size).toBe('Medium')
  })

  it('omits speed and size until a race is chosen', () => {
    const d = derived(scores(character({ raceId: null }), { DEX: 14 }))

    expect(d.speed).toBeUndefined()
    expect(d.size).toBeUndefined()
  })

  it('omits initiative and armor class until Dexterity is assigned, rather than reporting 0', () => {
    const d = derived(scores(character({ raceId: 'srd-2024_dwarf' }), { STR: 14 }))

    expect(d.initiative).toBeUndefined()
    expect(d.armorClass).toBeUndefined()
  })
})

describe('hit points (UT-71)', () => {
  it('adds the Constitution modifier to the class hit die', () => {
    expect(derived(scores(character(), { CON: 13 })).hitPoints).toBe(11)
    expect(derived(scores(character({ classId: 'srd-2024_wizard' }), { CON: 13 })).hitPoints).toBe(7)
  })

  it('subtracts a negative Constitution modifier instead of clamping it', () => {
    expect(derived(scores(character(), { CON: 8 })).hitPoints).toBe(9)
  })

  it('reports nothing until a class is chosen, rather than a bare hit die', () => {
    expect(derived(scores(character({ classId: null }), { CON: 13 })).hitPoints).toBeUndefined()
  })
})

describe('trait and feature descriptions (UT-73)', () => {
  it('shows a chosen race trait and its description', () => {
    render(<RaceStep character={character()} onChange={vi.fn()} />)

    expect(screen.getByText('Skillful')).toBeInTheDocument()
    expect(screen.getByText(/You gain proficiency in one skill/)).toBeInTheDocument()
  })

  it('shows a chosen class feature and its description', () => {
    render(<ClassStep character={character()} onChange={vi.fn()} />)

    expect(screen.getByText('Second Wind')).toBeInTheDocument()
    expect(screen.getByText(/regain 1d10/)).toBeInTheDocument()
  })

  it('renders markdown emphasis as elements, never as literal syntax', () => {
    const { container } = render(
      <Markdown source={'A **bold** claim with *emphasis*.\n\n|Trait|Value|\n|---|---|\n|Speed|30 feet|'} />,
    )

    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('emphasis').tagName).toBe('EM')
    expect(container.textContent).not.toContain('**')
    expect(container.textContent).not.toContain('|')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

const coreTrait = (desc: string): RawClass['features'][number] => ({
  name: 'Core Fighter Traits',
  desc,
  gained_at: null,
  data_for_class_table: null,
})

const classRecord = (
  features: RawClass['features'],
  saving_throws: { name: string }[],
): Envelope<RawClass> => ({
  type: 'class',
  key: 'srd-2024_fighter',
  name: 'Fighter',
  document: 'srd-2024',
  data: { hit_dice: 'd10', saving_throws, subclass_of: null, caster_type: null, features },
})
