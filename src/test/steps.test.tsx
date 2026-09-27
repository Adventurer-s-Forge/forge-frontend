import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDraft } from "../characters/character";
import type { Character } from "../characters/character";
import {
  AttributeStep,
  BackgroundStep,
  ClassStep,
  ItemStep,
  NameStep,
  RaceStep,
  SkillsStep,
} from "../components/character/steps";
import { seedTestCatalog } from './fixtures'

beforeAll(seedTestCatalog)

function fighter(overrides: Partial<Character> = {}): Character {
  return {
    ...createDraft(),
    name: 'Arkes',
    raceId: 'srd_half-orc',
    classId: 'srd_fighter',
    backgroundId: 'srd_acolyte',
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
  it('offers every race with its ability bonuses', () => {
    render(<RaceStep character={createDraft()} onChange={vi.fn()} />)

    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByText(/STR \+2/)).toBeInTheDocument()
  })

  it('selects a race when clicked', async () => {
    const onChange = vi.fn()
    render(<RaceStep character={createDraft()} onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: /Half-Elf/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ raceId: 'srd_half-elf' }),
    )
  })

  it('marks the chosen race as checked', () => {
    render(<RaceStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Half-Orc/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('ClassStep', () => {
  it('shows the hit die and saving throws, and selects on click', async () => {
    const onChange = vi.fn()
    render(<ClassStep character={createDraft()} onChange={onChange} />)

    expect(screen.getByText(/d10 hit die/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Wizard/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 'srd_wizard' })
    )
  })
})

describe('BackgroundStep', () => {
  it('names the skills the background grants', async () => {
    const onChange = vi.fn()
    render(<BackgroundStep character={createDraft()} onChange={onChange} />)

    expect(screen.getByText(/Insight and Religion/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Acolyte/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundId: 'srd_acolyte' })
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
      abilities: { method: 'pointbuy', base: { STR: 15, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }, rolled: [], racialChoices: [] },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Increase STR' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease STR' })).toBeEnabled()
  })

  it('reports how much of the point-buy budget is spent', () => {
    const character = fighter({
      abilities: { method: 'pointbuy', base: { STR: 15, DEX: 15, CON: 15, INT: 8, WIS: 8, CHA: 8 }, rolled: [], racialChoices: [] },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByText('27 / 27 points spent')).toBeInTheDocument()
  })

  it('caps the racial ability choice at the allowed count', () => {
    const character = fighter({
      raceId: 'srd_half-elf',
      abilities: { method: 'standard', base: {}, rolled: [], racialChoices: ['DEX', 'CON'] },
    })
    render(<AttributeStep character={character} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'INT' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'DEX' })).toBeEnabled()
  })
})

describe('SkillStep', () => {
  it('excludes skills the background already grants', () => {
    render(<SkillsStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Insight/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Perception/ })).toBeInTheDocument()
  })

  it('disables the remaining options once the cap is reached', () => {
    const character = fighter({ skillIds: ['perception', 'survival'] })
    render(<SkillsStep character={character} onChange={vi.fn()} />)

    expect(screen.getByText('2 / 2 chosen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Athletics/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Perception/ })).toBeEnabled()
  })

  it('asks for a class first when none is chosen', () => {
    render(<SkillsStep character={createDraft()} onChange={vi.fn()} />)

    expect(screen.getByText('Choose a class first.')).toBeInTheDocument()
  })
})

describe('ItemStep', () => {
  it('groups items by category', () => {
    render(<ItemStep character={fighter()} onChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Weapons' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Armor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gear' })).toBeInTheDocument()
  })

  it('toggles an item', async () => {
    const onChange = vi.fn()
    render(<ItemStep character={fighter()} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Longsword' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ itemIds: ['srd_longsword'] }),
    )
  })
})