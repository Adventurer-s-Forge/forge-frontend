import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../pages/Dashboard";
import { MemoryRouter } from "react-router";
import { STEPS, createDraft, type Character } from "../characters/character";
import { completeStep, setClass, setEquipmentChoice, setRace } from "../characters/progress";
import { seedTestCatalog } from "./fixtures";

const fb = vi.hoisted(() => ({ signOut: vi.fn() }))

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))
vi.mock('firebase/auth', () => fb)
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'u1', email: 'a@b.com', displayName: 'TestName' },
    loading: false,
    refreshUser: vi.fn(),
    redirectError: null,
    clearRedirectError: vi.fn(),
  }),
}))

const chars = vi.hoisted(() => ({
  characters: [] as Character[],
  save: vi.fn(),
  remove: vi.fn()
}))

vi.mock('../characters/useCharacters', () => ({
  useCharacters: () => ({
    characters: chars.characters,
    loading: false,
    error: null,
    save: chars.save,
    remove: chars.remove,
  }),
}))

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chars.characters = []
  })

  it('prefers the display name over the email', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )
    expect(screen.getByText('TestName')).toBeInTheDocument()
  })

  it('signs the user out', async () => {
    fb.signOut.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(fb.signOut).toHaveBeenCalledWith({})
  })

  it('surfaces a failed sign-out instead of swallowing it', async () => {
    fb.signOut.mockRejectedValue(
      new FirebaseError('auth/network-request-failed', 'raw')
    )
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })

  it('duplicates with a single write and leaves the source alone', async () => {
    const source = { ...createDraft(), id: 'c1', name: 'Arkes' }
    chars.characters = [source]
    chars.save.mockImplementation(async (c: Character) => c)

    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /duplicate/i }))

    expect(chars.save).toHaveBeenCalledTimes(1)
    const written = chars.save.mock.calls[0][0] as Character
    expect(written.id).not.toBe('c1')
    expect(written.name).toBe('Arkes (copy)')
    expect(source.name).toBe('Arkes')
  })

  it('surfaces a failed duplication instead of swallowing it', async () => {
    chars.characters = [{ ...createDraft(), id: 'c1', name: 'Arkes' }]
    chars.save.mockRejectedValue(new Error('Server said no'))

    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /duplicate/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Server said no')
  })
})
/** Every step answered against the test catalog: a Dwarf Fighter with CON 13, so d10 + 1 = 11 HP. */
function finished(): Character {
  let c: Character = { ...createDraft(), id: 'c2', name: 'Brannoc', backgroundId: 'srd-2024_acolyte' }
  c = setRace(c, 'srd-2024_dwarf')
  c = setClass(c, 'srd-2024_fighter')
  c = setEquipmentChoice(c, 'class', 'B')
  c = {
    ...c,
    fightingStyleId: 'defense',
    abilities: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      rolled: [],
      originBonuses: { INT: 2, WIS: 1 },
    },
    proficientSkillIds: ['perception', 'survival'],
  }
  for (const { id } of STEPS) c = completeStep(c, id)
  return c
}

describe('the card actions (FR-8)', () => {
  beforeAll(seedTestCatalog)

  beforeEach(() => {
    vi.clearAllMocks()
    chars.characters = []
  })

  const show = () => render(<MemoryRouter><Dashboard /></MemoryRouter>)
  const draft = (): Character => ({ ...createDraft(), id: 'c1', name: 'Arkes' })

  it('keeps a name on every action while its label waits for a hover', () => {
    chars.characters = [draft()]
    show()

    for (const name of ['Resume', 'Simulate', 'Duplicate', 'Delete Arkes']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('holds the simulator back until the character is finished', () => {
    chars.characters = [draft()]
    show()

    const simulate = screen.getByRole('button', { name: 'Simulate' })
    expect(simulate).toBeDisabled()
    expect(simulate).toHaveAttribute('title', 'Finish the character to simulate its hit points')
  })

  it('opens a finished character in the simulator, at full every time', async () => {
    chars.characters = [finished()]
    show()
    const current = () =>
      screen.getByRole('region', { name: 'Hit points' }).querySelector('.hp-current')?.textContent

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simulate' }))
    expect(screen.getByRole('dialog', { name: 'Brannoc' })).toBeInTheDocument()
    expect(current()).toBe('11')

    await userEvent.type(screen.getByLabelText('Damage taken'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Take 4 damage' }))
    expect(current()).toBe('7')

    const dialog = screen.getByRole('dialog', { name: 'Brannoc' })
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[1])
    expect(screen.queryByRole('dialog', { name: 'Brannoc' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Simulate' }))
    expect(current()).toBe('11')
  })

  it('keeps the label showing while a duplicate is in flight', async () => {
    chars.characters = [draft()]
    chars.save.mockReturnValue(new Promise(() => {}))
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(screen.getByRole('button', { name: 'Duplicating...' })).toHaveAttribute('aria-busy', 'true')
  })
})
