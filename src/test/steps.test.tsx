import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDraft } from "../characters/character";
import {
  AttributeStep,
  BackgroundStep,
  ClassStep,
  EquipmentStep,
  NameStep,
  RaceStep,
  SkillsStep,
  SpellsStep,
} from "../components/character/steps";
import { seedTestCatalog } from './fixtures'
import { setEquipmentChoice } from "../characters/progress";
import type { AbilityScores, Character } from "../characters/character";

beforeAll(seedTestCatalog)

function fighter(overrides: Partial<Character> = {}): Character {
  return {
    ...createDraft(),
    name: 'Arkes',
    raceId: 'srd-2024_human',
    classId: 'srd-2024_fighter',
    backgroundId: 'srd-2024_acolyte',
    ...overrides,
  }
}

describe('NameStep', () => {
  it('reports each keystroke', async () => {
    const onChange = vi.fn()
    render(<NameStep character={createDraft()} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Character name'), 'N')

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'N' }))
  })
})

describe('RaceStep', () => {
  it('offers every race with its speed and senses', () => {
    render(<RaceStep character={createDraft()} onChange={vi.fn()} />)

    expect(screen.getAllByRole('radio')).toHaveLength(2)

    const human = screen.getByRole('radio', { name: /Human/ })
    expect(human).toHaveTextContent('Speed 30')
    expect(human).toHaveTextContent('Skillful')

    expect(screen.getByRole('radio', { name: /Dwarf/ })).toHaveTextContent('Darkv. 120')
  })

  it('selects a race when clicked', async () => {
    const onChange = vi.fn()
    render(<RaceStep character={createDraft()} onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: /Dwarf/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ raceId: 'srd-2024_dwarf' }),
    )
  })

  it('marks the chosen race as checked', () => {
    render(<RaceStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Human/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('shows the selected race with its height note', () => {
    render(<RaceStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Human' })).toBeInTheDocument()
    expect(screen.getByText('about 4–7 feet tall')).toBeInTheDocument()
  })

  it('swaps the height note when another size is chosen', () => {
    render(<RaceStep character={fighter({ sizeChoice: 'Small' })} onChange={vi.fn()} />)

    expect(screen.getByText('about 2–4 feet tall')).toBeInTheDocument()
    expect(screen.queryByText('about 4–7 feet tall')).not.toBeInTheDocument()
  })

  it('offers no size choice for a race with one size', () => {
    render(<RaceStep character={fighter({ raceId: 'srd-2024_dwarf' })} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Small' })).not.toBeInTheDocument()
    expect(screen.getByText('about 4–5 feet tall')).toBeInTheDocument()
  })

  it('clears the race from the detail panel', async () => {
    const onChange = vi.fn()
    render(<RaceStep character={fighter()} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raceId: null }))
  })

})

describe('ClassStep', () => {
  it('shows the hit die and saves, and selects on click', async () => {
    const onChange = vi.fn()
    render(<ClassStep character={createDraft()} onChange={onChange} />)

    expect(screen.getByRole('radio', { name: /Fighter/ })).toHaveTextContent('d10 · STR/CON')

    await userEvent.click(screen.getByRole('radio', { name: /Wizard/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 'srd-2024_wizard' })
    )
  })

  it('tags caster and leaves non-casters untagged', () => {
    render(<ClassStep character={createDraft()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Wizard/ })).toHaveTextContent('Caster')
    expect(screen.getByRole('radio', { name: /Fighter/ })).not.toHaveTextContent('Caster')
  })

  it('offers a fighting style for a fighter and records the pick', async () => {
    const onChange = vi.fn()
    render(<ClassStep character={fighter()} onChange={onChange} />)

    await userEvent.selectOptions(screen.getByLabelText(/Fighting Style/), 'defense')

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fightingStyleId: 'defense' })
    )
  })

  it('offers no fighting style for a class that has none', () => {
    render(<ClassStep character={fighter({ classId: 'srd-2024_wizard' })} onChange={vi.fn()} />)

    expect(screen.queryByLabelText(/Fighting Style/)).not.toBeInTheDocument()
  })

  it('shows the startign equipment options beside the stats', () => {
    render(<ClassStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.getByText('Chain mail, Longsword, and 5 GP')).toBeInTheDocument()
    expect(screen.getByText('75 GP')).toBeInTheDocument()
  })

  it('omits proficiency lines the class data does not carry', () => {
    render(<ClassStep character={fighter({ classId: 'srd-2024_wizard' })} onChange={vi.fn()} />)

    expect(screen.getByText('Proficiencies')).toBeInTheDocument()
    expect(screen.queryByText(/^Armor:/)).not.toBeInTheDocument()
  })
})

describe('BackgroundStep', () => {
  it('selects a background when clicked', async () => {
    const onChange = vi.fn()
    render(<BackgroundStep character={createDraft()} onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: /Acolyte/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundId: 'srd-2024_acolyte' }),
    )
  })

  it('shows the ability options on each tile', () => {
    render(<BackgroundStep character={createDraft()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Acolyte/ })).toHaveTextContent('INT WIS CHA')
  })

  it('shows the feat, skills and tool for the selected background', () => {
    render(<BackgroundStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.getByText('Magic Initiate (Cleric)')).toBeInTheDocument()
    expect(screen.getByText('Insight, Religion')).toBeInTheDocument()
    expect(screen.getByText("Calligrapher's Supplies")).toBeInTheDocument()
  })

  it('offers no tool choice when the tool is granted outright', () => {
    render(<BackgroundStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.queryByLabelText(/Choose —/)).not.toBeInTheDocument()
  })

  it('offers the gaming sets and records the choice', async () => {
    const onChange = vi.fn()
    render(
      <BackgroundStep
        character={fighter({ backgroundId: 'srd-2024_soldier' })}
        onChange={onChange}
      />,
    )

    await userEvent.selectOptions(
      screen.getByLabelText(/Gaming Set/),
      'srd-2024_gaming-set-dice',
    )

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ toolChoiceId: 'srd-2024_gaming-set-dice' }),
    )
  }) 
})

describe('AttributeStep', () => {
  it('records the generation method chosen', async () => {
    const onChange = vi.fn()
    render(<AttributeStep character={fighter()} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Point buy/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: expect.objectContaining({ method: 'pointbuy' }),
      }),
    )
  })

  it('stops point buy at the maximum score', async () => {
    const character = fighter({
      abilities: { method: 'pointbuy', base: { STR: 15, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }, rolled: [], originBonuses: {} },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Increase STR' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease STR' })).toBeEnabled()
  })

  it('reports how much of the point-buy budget is spent', () => {
    const character = fighter({
      abilities: { method: 'pointbuy', base: { STR: 15, DEX: 15, CON: 15, INT: 8, WIS: 8, CHA: 8 }, rolled: [], originBonuses: {} },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByText('27 / 27 points spent')).toBeInTheDocument()
  })

  it('reports the results of using the roll method', () => {
    const character = fighter({
      abilities: { method: 'roll', base: {}, rolled: [10, 15, 9, 8, 15, 8], originBonuses: {} },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByText('Roll Results: 15, 15, 10, 9, 8, 8')).toBeInTheDocument()
  })

  it('caps the origin allocation at +3', () => {
    const character = fighter({
      abilities: { method: 'standard', base: {}, rolled: [], originBonuses: { INT: 2, WIS: 1 } },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByText(/3 \/ 3 assigned/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase CHA bonus' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease INT bonus' })).toBeEnabled()
  })
})

describe('point-buy advice (US-41, FR-15)', () => {
  /** A Wizard with the Acolyte background (INT, WIS, CHA) on point buy, every score 8 unless given. */
  const wizard = (base: Partial<AbilityScores>, originBonuses: Partial<AbilityScores>) =>
    fighter({
      classId: 'srd-2024_wizard',
      abilities: {
        method: 'pointbuy',
        base: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8, ...base },
        rolled: [],
        originBonuses,
      },
    })

  const panel = () => screen.getByRole('group', { name: 'Point-buy advice' })
  const advice = () => within(panel())
  const flags = () => advice().queryAllByRole('listitem').map((item) => item.textContent)

  it('flags a score that a cheaper one matches once its bonus is added, naming the cheaper score', () => {
    render(<AttributeStep character={wizard({ INT: 13, WIS: 14 }, { WIS: 1, CHA: 2 })} onChange={vi.fn()} />)

    expect(flags()).toEqual([
      'INT 13 gives +1, the same as 12, which costs 1 point less.',
      'WIS 14 + 1 gives +2, the same as 13 + 1, which costs 2 points less.',
    ])
    expect(advice().getByText('2 scores waste points')).toBeInTheDocument()
  })

  it('leaves an odd score alone when a +1 bonus lifts it to the next modifier', () => {
    render(<AttributeStep character={wizard({ INT: 13 }, { INT: 1, WIS: 2 })} onChange={vi.fn()} />)

    expect(flags()).toEqual([])
    expect(advice().getByText('No wasted points')).toBeInTheDocument()
  })

  it('recommends the best spread for the class and background, with a reason on every score', () => {
    render(<AttributeStep character={wizard({}, {})} onChange={vi.fn()} />)
    const table = within(advice().getByRole('table', { name: 'Recommended scores' }))
    const rows = table.getAllByRole('row').slice(1).map((row) => [...row.children].map((cell) => cell.textContent))

    expect(rows).toEqual([
      ['STR', '12', '\u2014', '12', '+1', 'Lower priority for a Wizard.'],
      ['DEX', '12', '\u2014', '12', '+1', 'Lower priority for a Wizard.'],
      ['CON', '14', '\u2014', '14', '+2', 'Constitution adds hit points for every class.'],
      ['INT', '14', '+2', '16', '+3', 'Primary ability for a Wizard. Takes the +2.'],
      ['WIS', '13', '+1', '14', '+2', 'Wizard saving throw. Odd on purpose: the +1 brings it to 14.'],
      ['CHA', '8', '\u2014', '8', '\u22121', 'Lower priority for a Wizard. Left at 8 so the points go further elsewhere.'],
    ])
    expect(advice().getByText(/using 27 of 27 points/)).toBeInTheDocument()
  })

  it("never changes the player's scores or bonuses", () => {
    const onChange = vi.fn()
    const character = wizard({ INT: 13 }, { WIS: 2, CHA: 1 })
    const before = structuredClone(character)

    render(<AttributeStep character={character} onChange={onChange} />)

    expect(advice().queryAllByRole('button')).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
    expect(character).toEqual(before)
    expect(screen.getByRole('button', { name: 'Increase INT' }).previousSibling).toHaveTextContent('13')
  })

  it('follows the player as they change a score or a bonus', () => {
    const { rerender } = render(<AttributeStep character={wizard({ INT: 13 }, { WIS: 2, CHA: 1 })} onChange={vi.fn()} />)
    expect(flags()).toHaveLength(1)

    rerender(<AttributeStep character={wizard({ INT: 12 }, { WIS: 2, CHA: 1 })} onChange={vi.fn()} />)
    expect(flags()).toEqual([])

    rerender(<AttributeStep character={wizard({ INT: 12 }, { INT: 1, WIS: 2 })} onChange={vi.fn()} />)
    expect(flags()).toEqual(['INT 12 + 1 gives +1, the same as 11 + 1, which costs 1 point less.'])
  })

  it('opens above the calculated values, and stays folded once the player folds it', async () => {
    const { rerender } = render(<AttributeStep character={wizard({ INT: 13 }, {})} onChange={vi.fn()} />)
    const calculated = screen.getByText('Calculated for you')

    expect(panel().parentElement).toBe(calculated.parentElement)
    expect(panel().compareDocumentPosition(calculated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel()).toHaveAttribute('open')

    await userEvent.click(advice().getByText('Point-buy advice'))
    expect(panel()).not.toHaveAttribute('open')
    expect(advice().getByText('1 score wastes points')).toBeInTheDocument()

    rerender(<AttributeStep character={wizard({ INT: 12 }, {})} onChange={vi.fn()} />)
    expect(panel()).not.toHaveAttribute('open')
  })

  it('stays out of the way for the standard array and rolled scores', () => {
    render(<AttributeStep character={fighter({ abilities: { method: 'standard', base: {}, rolled: [], originBonuses: {} } })} onChange={vi.fn()} />)

    expect(screen.queryByRole('group', { name: 'Point-buy advice' })).not.toBeInTheDocument()
  })
})

describe('SkillStep', () => {
  it('excludes skills the background already grants', () => {
    render(<SkillsStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Insight/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Perception/ })).toBeInTheDocument()
  })

  it('disables the remaining options once the cap is reached', () => {
    const character = fighter({ proficientSkillIds: ['perception', 'survival'] })
    render(<SkillsStep character={character} onChange={vi.fn()} />)

    expect(screen.getByText(/choose 2 \u2014 2 \/ 2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Athletics/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Perception/ })).toBeEnabled()
  })

  it('asks for a class first when none is chosen', () => {
    render(<SkillsStep character={createDraft()} onChange={vi.fn()} />)

    expect(screen.getByText('Choose a class first.')).toBeInTheDocument()
  })
})

describe('EquipmentStep', () => {
  const classGroup = () => screen.getByRole('group', { name: /Fighter/ })
  const market = () => screen.getByRole('group', { name: /Market/ })

  it('offers the class options and records the pick', async () => {
    const onChange = vi.fn()
    render(<EquipmentStep character={fighter()} onChange={onChange} />)

    await userEvent.click(within(classGroup()).getByRole('button', { name: /75 GP/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        equipmentChoice: expect.objectContaining({ class: expect.objectContaining({ key: 'B' }) }),
      }),
    )
  })

  it('deselects an option that is clicked again', async () => {
    const onChange = vi.fn()
    render(
      <EquipmentStep
        character={setEquipmentChoice(fighter(), 'class', 'B')}
        onChange={onChange}
      />,
    )

    await userEvent.click(within(classGroup()).getByRole('button', { name: /75 GP/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentChoice: expect.objectContaining({ class: null }) }),
    )
  })

  it('narrows the market to the search text', async () => {
    render(
      <EquipmentStep
        character={setEquipmentChoice(fighter(), 'class', 'B')}
        onChange={vi.fn()}
      />,
    )

    expect(within(market()).getByRole('button', { name: /Longsword/ })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search'), 'rope')

    expect(within(market()).queryByRole('button', { name: /Longsword/ })).not.toBeInTheDocument()
    expect(within(market()).getByRole('button', { name: /Rope/ })).toBeInTheDocument()
  })

  it('disables what the purse cannot cover', () => {
    render(
      <EquipmentStep
        character={setEquipmentChoice(fighter(), 'class', 'A')}
        onChange={vi.fn()}
      />,
    )

    // Option A grants 5 GP, so chain mail at 75 GP is out of reach.
    expect(within(market()).getByRole('button', { name: /Chain mail/ })).toBeDisabled()
  })
})


describe('SpellsStep', () => {
  it('tells a non-caster there is nothing to choose', () => {
    render(<SpellsStep character={fighter()} onChange={vi.fn()} />)
    expect(screen.getByText(/cast spells/)).toBeInTheDocument()
  })

  it('splits cantrips from levelled spells', () => {
    const wizard = fighter({ classId: 'srd-2024_wizard' })
    render(<SpellsStep character={wizard} onChange={vi.fn()} />)

    expect(screen.getByText('Cantrips \u2014 0 / 1')).toBeInTheDocument()
    expect(screen.getByText('1st level \u2014 0 / 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fire Bolt/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shield/ })).toBeInTheDocument()
  })

  it('reports the chosen spell', async () => {
    const onChange = vi.fn()
    render(<SpellsStep character={fighter({ classId: 'srd-2024_wizard' })} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Fire Bolt/ }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ spellIds: ['srd-2024_fire-bolt'] }))
  })
})