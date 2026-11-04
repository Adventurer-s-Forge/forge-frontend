import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPanel } from "../components/SearchPanel";
import { Dashboard } from "../pages/Dashboard";
import { seedTestCatalog } from "./fixtures";
import type { Envelope } from "../lib/api";
import type { Character } from "../characters/character";

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }))
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
  remove: vi.fn(),
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

const envelope = (type: string, key: string, name: string, data: unknown): Envelope<unknown> => ({
  type,
  key,
  name,
  document: 'srd-2024',
  data,
})

const RESULTS = [
  envelope('skill', 'stealth', 'Stealth', { ability: 'dex' }),
  envelope('equipment', 'srd-2024_longsword', 'Longsword', {
    category: { key: 'weapon', name: 'Weapon' },
    desc: 'A versatile blade.',
    weapon: { damage_dice: '1d8' },
    cost: '15 gp',
    armor: null,
  }),
]

function stubSearch(body: unknown, status = 200) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const filters = () => within(screen.getByRole('group', { name: 'Filter by content type' }))

beforeAll(seedTestCatalog)

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  chars.characters = []
  vi.stubEnv('VITE_API_BASE_URL', 'http://content.test')
})

describe('SearchPanel', () => {
  it('waits for typing to settle before asking the service once', async () => {
    const fetchMock = stubSearch(RESULTS)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'longsword')

    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('searches nothing until the term is long enough', async () => {
    const fetchMock = stubSearch(RESULTS)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'l')

    expect(screen.getByText(/Type at least 2 letters/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('narrows the results to one content type without asking again', async () => {
    const fetchMock = stubSearch(RESULTS)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    await userEvent.click(filters().getByRole('button', { name: /Equipment/ }))

    expect(screen.getByText('Longsword')).toBeInTheDocument()
    expect(screen.queryByText('Stealth')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('disables a filter no result belongs to', async () => {
    stubSearch(RESULTS)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    expect(filters().getByRole('button', { name: /Spells/ })).toBeDisabled()
    expect(filters().getByRole('button', { name: /Equipment/ })).toBeEnabled()
  })

  it('reads out a chosen result, naming where it came from', async () => {
    stubSearch(RESULTS)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /Longsword/ }))

    expect(screen.getByRole('heading', { name: 'Longsword' })).toBeInTheDocument()
    expect(screen.getByText('srd-2024')).toBeInTheDocument()
  })

  it('explains a rejected search instead of showing an empty list', async () => {
    stubSearch({}, 422)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/needs a term/))
  })

  it('says so plainly when nothing matches', async () => {
    stubSearch([])
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'zzzz')

    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeInTheDocument())
  })
})

describe('browsing content from the wizard', () => {
  async function openWizardWithDraft() {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'New character' }))
    await userEvent.type(screen.getByLabelText('Character name'), 'Arkes')
  }

  it('keeps the in-progress draft when the browser opens and closes', async () => {
    stubSearch(RESULTS)
    await openWizardWithDraft()

    // Both the app bar and the wizard header offer it; the wizard's is the later one.
    const buttons = screen.getAllByRole('button', { name: /Browse content/ })
    await userEvent.click(buttons[buttons.length - 1])

    const panel = screen.getByRole('dialog', { name: 'Browse game content' })
    expect(within(panel).getByRole('heading', { name: 'Browse content' })).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: 'Close' }))

    // A remount would have thrown the draft away and reset the field.
    expect(screen.queryByRole('dialog', { name: 'Browse game content' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Character name')).toHaveValue('Arkes')
  })

  it('does not close itself while opening', async () => {
    stubSearch(RESULTS)
    await openWizardWithDraft()

    const buttons = screen.getAllByRole('button', { name: /Browse content/ })
    await userEvent.click(buttons[buttons.length - 1])

    // Guards the dialog's close event being wired to onClose instead of a backdrop click.
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Browse game content' })).toBeInTheDocument(),
    )
  })
})
