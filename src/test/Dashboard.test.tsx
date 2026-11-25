import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../pages/Dashboard";
import { MemoryRouter } from "react-router";
import { STEPS, createDraft, type Character } from "../characters/character";
import { completeStep, setClass, setEquipmentChoice, setRace } from "../characters/progress";
import { seedTestCatalog } from "./fixtures";

const fb = vi.hoisted(() => ({ signOut: vi.fn() }))

type TestUser = { uid: string; email: string; displayName: string | null; providerData: { displayName: string | null }[] }

const signedInAs = (user: Partial<TestUser> = {}): TestUser => ({
  uid: 'u1',
  email: 'a@b.com',
  displayName: 'TestName',
  providerData: [],
  ...user,
})

/** Whoever is signed in. A test can swap the user; each test starts back on the default. */
const session = vi.hoisted(() => ({ user: null as unknown as TestUser }))

beforeEach(() => {
  session.user = signedInAs()
})

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))
vi.mock('firebase/auth', () => fb)
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: session.user,
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

/** Generation is a store call, not a hook one: it must not touch the roster. */
const store = vi.hoisted(() => ({ randomize: vi.fn() }))

vi.mock('../characters/storage', () => ({ characterStore: { randomize: store.randomize } }))

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

describe('opening the character sheet (US-32, FR-13)', () => {
  beforeAll(seedTestCatalog)

  beforeEach(() => {
    vi.clearAllMocks()
    chars.characters = [finished()]
  })

  /** Opens Brannoc's sheet from the card, the way a player would. */
  async function openSheet() {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^Brannoc/ }))
    return screen.getByRole('dialog', { name: 'Brannoc' })
  }

  const playerName = (sheet: HTMLElement) =>
    within(within(sheet).getByRole('article', { name: 'Character' })).getByText('Player name').previousSibling?.textContent

  it('opens the sheet when the card is clicked, rather than the wizard', async () => {
    const sheet = await openSheet()

    expect(within(sheet).getByRole('article', { name: 'Character' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Create character' })).not.toBeInTheDocument()
  })

  it('keeps Edit on the card going straight to the wizard', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('dialog', { name: 'Create character' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Character' })).not.toBeInTheDocument()
  })

  it("swaps the sheet for the wizard when the sheet's own Edit is pressed", async () => {
    const sheet = await openSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Edit' }))

    expect(screen.queryByRole('article', { name: 'Character' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Create character' })).toBeInTheDocument()
  })

  it('closes the sheet back to the dashboard', async () => {
    const sheet = await openSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('article', { name: 'Character' })).not.toBeInTheDocument()
  })

  it('prints the first word of the account name as the player name', async () => {
    session.user = signedInAs({ displayName: 'Paul De Silos' })

    expect(playerName(await openSheet())).toBe('Paul')
  })

  it('takes the name from a linked Google or GitHub account when the account has none of its own', async () => {
    session.user = signedInAs({
      displayName: null,
      providerData: [{ displayName: null }, { displayName: 'Ada Lovelace' }],
    })

    expect(playerName(await openSheet())).toBe('Ada')
  })

  it('leaves the player name blank when no account carries a name', async () => {
    session.user = signedInAs({ displayName: null, providerData: [{ displayName: null }] })

    expect(playerName(await openSheet())).toBe('')
  })
})

describe('generating a random character (US-39, FR-14)', () => {
  beforeAll(seedTestCatalog)

  beforeEach(() => {
    vi.clearAllMocks()
    chars.characters = []
  })

  /** A generated record as the service hands one back: complete, unsaved, own UUID. */
  const generated = (overrides: Partial<Character> = {}): Character => ({
    ...finished(),
    id: 'g-1',
    name: 'Random Dwarf Fighter',
    ...overrides,
  })

  function deferred<T>() {
    let settle: (value: T) => void = () => {}
    const promise = new Promise<T>((resolve) => { settle = resolve })
    return { promise, resolve: (value: T) => settle(value) }
  }

  const show = () => render(<MemoryRouter><Dashboard /></MemoryRouter>)
  const dialog = () => screen.queryByRole('dialog', { name: 'Random Dwarf Fighter' })

  async function review(): Promise<HTMLElement> {
    await userEvent.click(screen.getByRole('button', { name: 'Randomize' }))
    return await screen.findByRole('dialog', { name: 'Random Dwarf Fighter' })
  }

  it('generates once, shows the review unsaved, and writes nothing', async () => {
    const pending = deferred<Character>()
    store.randomize.mockReturnValue(pending.promise)
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Randomize' }))

    expect(screen.getByRole('button', { name: 'Randomizing...' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'New character' })).toBeDisabled()
    expect(store.randomize).toHaveBeenCalledTimes(1)

    pending.resolve(generated())

    const sheet = await screen.findByRole('dialog', { name: 'Random Dwarf Fighter' })
    expect(within(sheet).getByText('Not saved')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Keep character' })).toBeInTheDocument()
    expect(chars.save).not.toHaveBeenCalled()
    expect(chars.remove).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled()
    expect(screen.getByText('No characters yet')).toBeInTheDocument()
  })

  it('ignores a second activation while a generation is in flight', async () => {
    store.randomize.mockReturnValue(new Promise(() => {}))
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Randomize' }))
    await userEvent.click(screen.getByRole('button', { name: 'Randomizing...' }))

    expect(store.randomize).toHaveBeenCalledTimes(1)
  })

  it('discarding a preview saves nothing', async () => {
    store.randomize.mockResolvedValue(generated())
    show()

    const sheet = await review()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Discard' }))

    expect(dialog()).not.toBeInTheDocument()
    expect(chars.save).not.toHaveBeenCalled()
    expect(chars.remove).not.toHaveBeenCalled()
  })

  it('closing, escaping or clicking away saves nothing', async () => {
    store.randomize.mockResolvedValue(generated())
    show()

    await userEvent.click(within(await review()).getByRole('button', { name: 'Close' }))
    expect(dialog()).not.toBeInTheDocument()

    const escaped = await review()
    expect(fireEvent(escaped, new Event('cancel', { cancelable: true }))).toBe(false)
    expect(dialog()).not.toBeInTheDocument()

    fireEvent.click(await review())
    expect(dialog()).not.toBeInTheDocument()

    expect(chars.save).not.toHaveBeenCalled()
  })

  it('keeps the exact candidate once, adds the card and announces success', async () => {
    const candidate = generated()
    store.randomize.mockResolvedValue(candidate)
    chars.save.mockImplementation(async (character: Character) => {
      chars.characters = [...chars.characters, character]
      return character
    })
    show()

    const sheet = await review()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Keep character' }))

    await waitFor(() => expect(chars.save).toHaveBeenCalledTimes(1))
    expect(chars.save.mock.calls[0][0]).toEqual(candidate)
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Character Saved')
    expect(screen.getByRole('button', { name: /^Random Dwarf Fighter/ })).toBeInTheDocument()
    expect(screen.queryByText('No characters yet')).not.toBeInTheDocument()
  })

  it('blocks every dismissal while a keep is in flight', async () => {
    store.randomize.mockResolvedValue(generated())
    chars.save.mockReturnValue(new Promise(() => {}))
    show()

    const sheet = await review()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Keep character' }))

    expect(within(sheet).getByRole('button', { name: 'Keeping...' })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: 'Discard' })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeDisabled()

    fireEvent(sheet, new Event('cancel', { cancelable: true }))
    fireEvent.click(sheet)

    expect(dialog()).toBeInTheDocument()
  })

  it('surfaces a failed generation and restores the controls', async () => {
    store.randomize.mockRejectedValue(
      new Error('Random character generation is unavailable because reference data is incomplete.'),
    )
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Randomize' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Random character generation is unavailable')
    expect(screen.getByRole('button', { name: 'Randomize' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'New character' })).toBeEnabled()
    expect(dialog()).not.toBeInTheDocument()
  })

  it('keeps the candidate on screen when a keep fails, and retries', async () => {
    const candidate = generated()
    store.randomize.mockResolvedValue(candidate)
    chars.save.mockRejectedValueOnce(new Error('That character has already been saved.'))
    show()

    const sheet = await review()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Keep character' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('already been saved')
    expect(dialog()).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Keep character' })).toBeEnabled()
    expect(within(sheet).getByRole('heading', { name: 'Random Dwarf Fighter' })).toBeInTheDocument()

    chars.save.mockResolvedValue(candidate)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Keep character' }))

    await waitFor(() => expect(chars.save).toHaveBeenCalledTimes(2))
    expect(chars.save.mock.calls[1][0]).toEqual(candidate)
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })
})
