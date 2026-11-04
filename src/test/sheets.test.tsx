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

/** A Human Fighter by default - the two fixtures with full trait and feature data. */
function character(overrides: Partial<Character> = {}): Character {
  return {
    ...createDraft(),
    raceId: 'srd-2024_human',
    classId: 'srd-2024_fighter',
    ...overrides,
  }
}

const scores = (c: Character, base: Partial<Record<Ability, number>>): Character => ({
  ...c,
  abilities: { ...c.abilities, base },
})

describe('saving throws and proficiency (TC-28)', () => {
  it('gives a level 1 fighter proficiency 2 and proficient Strength and Constitution saves', () => {
    const d = derived(scores(character(), { STR: 15, CON: 14, DEX: 12 }))

    expect(d.proficiencyBonus).toBe(2)
    // Only abilities with an assigned score appear, in ABILITIES order.
    expect(d.savingThrows).toEqual([
      { ability: 'STR', modifier: 4, proficient: true },
      { ability: 'DEX', modifier: 1, proficient: false },
      { ability: 'CON', modifier: 4, proficient: true },
    ])
  })

  it('reads saving throws off the Core Traits table rather than the upstream field', () => {
    const cls = toClass(
      classRecord(
        [coreTrait('|Saving Throw Proficiencies|Strength and Constitution|')],
        [{ name: 'dexterity' }, { name: 'intelligence' }],
      ),
      [],
    )

    expect(cls.savingThrows).toEqual(['STR', 'CON'])
  })

  it('falls back to the upstream field when the class has no table row', () => {
    const cls = toClass(classRecord([], [{ name: 'dexterity' }, { name: 'intelligence' }]), [])

    expect(cls.savingThrows).toEqual(['DEX', 'INT'])
  })
})

describe('spellcasting profile (TC-30)', () => {
  it('derives ability, save DC, attack bonus and slots for a wizard', () => {
    const wizard = scores(character({ classId: 'srd-2024_wizard' }), { INT: 16 })
    const spells = spellDerived(wizard)

    expect(spells.ability).toBe('INT')
    expect(spells.abilityModifier).toBe(3)
    expect(spells.saveDC).toBe(13)
    expect(spells.attackBonus).toBe(5)
    expect(spells.slots).toBe(2)
  })

  it('leaves a non-caster without a profile', () => {
    const spells = spellDerived(scores(character(), { INT: 16 }))

    expect(spells.ability).toBeUndefined()
    expect(spells.abilityModifier).toBeUndefined()
    expect(spells.saveDC).toBeUndefined()
    expect(spells.attackBonus).toBeUndefined()
    expect(spells.slots).toBe(0)
  })
})

describe('initiative and speed (TC-35)', () => {
  it('takes initiative from Dexterity and speed from the race', () => {
    const d = derived(scores(character(), { DEX: 13 }))

    expect(d.initiative).toBe(1)
    expect(d.speed).toBe(30)
  })

  it('reports neither until a race and a Dexterity score exist', () => {
    const blank = derived(createDraft())

    expect(blank.initiative).toBeUndefined()
    expect(blank.speed).toBeUndefined()
  })
})

describe('hit points (TC-37)', () => {
  it('adds the Constitution modifier to the class hit die', () => {
    expect(derived(scores(character(), { CON: 14 })).hitPoints).toBe(12)
    expect(derived(scores(character({ classId: 'srd-2024_wizard' }), { CON: 14 })).hitPoints).toBe(8)
  })

  it('subtracts a negative Constitution modifier', () => {
    expect(derived(scores(character(), { CON: 8 })).hitPoints).toBe(9)
  })
})

describe('content descriptions (TC-36)', () => {
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

  it('leaves no markdown markers in the rendered prose', () => {
    const { container } = render(
      <Markdown source={'A **bold** claim with *emphasis*.\n\n|Trait|Value|\n|---|---|\n|Speed|30 feet|'} />,
    )

    expect(container.textContent).not.toContain('**')
    expect(container.textContent).not.toContain('|')
    expect(screen.getByText('bold')).toBeInTheDocument()
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
