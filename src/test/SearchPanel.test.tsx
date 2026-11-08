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

/** Answers an unfiltered ask with `body` and, when one is given, a `content_filter` ask
 * with `filtered` -- so a test can prove which ask produced the rows on screen. */
function stubSearch(body: unknown, status = 200, filtered?: unknown) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(filtered !== undefined && url.includes('content_filter') ? filtered : body),
        { status },
      ),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const lastUrl = (mock: { mock: { calls: [string][] } }) =>
  String(mock.mock.calls[mock.mock.calls.length - 1][0])

/** The page body /search sends. `total` and `counts` describe the whole match set, so a
 * page can report more matches than the records it carries. */
const pageOf = (result: Envelope<unknown>[], total: number, counts: Record<string, number> = {}) => ({
  total,
  counts,
  'num items on page': result.length,
  result,
})

const fill = (count: number, type: string, from = 0): Envelope<unknown>[] =>
  Array.from({ length: count }, (_, i) =>
    envelope(type, `${type}-${from + i}`, `${type} ${from + i}`, {}),
  )

/** A walk where every page comes back full and each page holds different records, the way the
 * service pages. One body repeated would hand the list ten copies of the same record, which
 * collide on `hit.id`. */
function stubWalk(perPage: number, type: string, total: number, counts: Record<string, number>) {
  const fetchMock = vi.fn((url: string) => {
    const page = Number(new URL(url, 'http://forge.test').searchParams.get('page') ?? '1')
    const body = pageOf(fill(perPage, type, (page - 1) * perPage), total, counts)
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  })
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

  it('asks the service again, narrowed, when a chip is clicked', async () => {
    const fetchMock = stubSearch(pageOf(RESULTS, 2, { skill: 1, equipment: 1 }))
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    await userEvent.click(filters().getByRole('button', { name: /Equipment/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('content_filter')
    expect(lastUrl(fetchMock)).toContain('content_filter=equipment')
    expect(screen.getByText('Longsword')).toBeInTheDocument()
    expect(screen.queryByText('Stealth')).not.toBeInTheDocument()
  })

  it('disables a filter the service has no matches for', async () => {
    stubSearch(pageOf(RESULTS, 2, { skill: 1, equipment: 1 }))
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    expect(filters().getByRole('button', { name: /Spells/ })).toBeDisabled()
    expect(filters().getByRole('button', { name: /Equipment/ })).toBeEnabled()
  })

  it('takes a chip number from the service rather than the rows on the page', async () => {
    // Fifty equipment records in hand; the service says 230 spells match in all.
    stubSearch(pageOf(fill(50, 'equipment'), 1268, { equipment: 136, spell: 230, monster: 231 }))
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'aa')

    await waitFor(() =>
      expect(filters().getByRole('button', { name: /Spells/ })).toHaveTextContent('Spells230'),
    )
    // Not one spell is on the page, yet the chip is live because the service counted 230.
    expect(filters().getByRole('button', { name: /Spells/ })).toBeEnabled()
    expect(filters().getByRole('button', { name: /Equipment/ })).toHaveTextContent('Equipment136')
  })

  it('replaces the rows with the service answer for the chip', async () => {
    const spellPage = pageOf([
      envelope('spell', 'srd-2024_fire-bolt', 'Fire Bolt', {
        level: 0,
        school: { name: 'Evocation' },
        classes: [],
        desc: 'You hurl a mote of fire.',
        casting_time: 'action',
        range_text: '120 feet',
        duration: 'instantaneous',
        concentration: false,
        ritual: false,
      }),
    ], 1, { spell: 1 })

    // RESULTS holds no spell at all, so this row cannot have come from filtering it.
    stubSearch(pageOf(RESULTS, 3, { skill: 1, equipment: 1, spell: 1 }), 200, spellPage)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'fire')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    await userEvent.click(filters().getByRole('button', { name: /Spells/ }))

    await waitFor(() => expect(screen.getByText('Fire Bolt')).toBeInTheDocument())
    expect(screen.queryByText('Longsword')).not.toBeInTheDocument()
  })

  it('keeps the global numbers on the chips while a filter is active', async () => {
    const spellPage = pageOf(fill(3, 'spell'), 230, { spell: 230 })
    stubSearch(pageOf(RESULTS, 1268, { skill: 12, equipment: 136, spell: 230 }), 200, spellPage)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'aa')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    await userEvent.click(filters().getByRole('button', { name: /Spells/ }))
    await waitFor(() =>
      expect(filters().getByRole('button', { name: /Spells/ })).toHaveAttribute('aria-pressed', 'true'),
    )

    // The filtered answer zeroes every other type; the chips must not follow it down.
    expect(filters().getByRole('button', { name: /Everything/ })).toHaveTextContent(
      `Everything${(1268).toLocaleString()}`,
    )
    expect(filters().getByRole('button', { name: /Equipment/ })).toHaveTextContent('Equipment136')
  })

  it('drops an active filter when the term changes', async () => {
    const spellPage = pageOf(fill(2, 'spell'), 230, { spell: 230 })
    const fetchMock = stubSearch(pageOf(RESULTS, 3, { skill: 1, equipment: 1, spell: 1 }), 200, spellPage)
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    await userEvent.click(filters().getByRole('button', { name: /Spells/ }))
    await waitFor(() =>
      expect(filters().getByRole('button', { name: /Spells/ })).toHaveAttribute('aria-pressed', 'true'),
    )

    await userEvent.type(screen.getByRole('searchbox'), 'sword')

    // A new term is a new search: unfiltered, so the counts belong to what is searched now.
    await waitFor(() =>
      expect(filters().getByRole('button', { name: /Everything/ })).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(lastUrl(fetchMock)).toContain('q=longsword')
    expect(lastUrl(fetchMock)).not.toContain('content_filter')
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

  it('names the global total in the notice rather than the page size', async () => {
    // Every page comes back full, so the walk stops at its ten page ceiling holding 1000.
    stubWalk(100, 'monster', 1268, { monster: 231, spell: 230 })
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'aboleth')

    const notice = await screen.findByText(/Showing 1000 of/, {}, { timeout: 5000 })

    expect(notice).toHaveTextContent(`of ${(1268).toLocaleString()} matches`)
  })

  it('shows no notice when the whole match set is in hand', async () => {
    stubSearch(pageOf(RESULTS, 2, { skill: 1, equipment: 1 }))
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'long')
    await waitFor(() => expect(screen.getByText('Longsword')).toBeInTheDocument())

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })

  it('folds a subclass into the Classes chip, the way the service counts it', async () => {
    const records = [
      envelope('class', 'srd-2024_fighter', 'Fighter', {
        subclass_of: null,
        hit_dice: 'd10',
        saving_throws: [{ name: 'strength' }, { name: 'constitution' }],
        caster_type: null,
        features: [],
      }),
      envelope('class', 'srd-2024_champion', 'Champion', {
        subclass_of: { name: 'Fighter', key: 'srd-2024_fighter' },
        desc: '*Pursue Physical Excellence in Combat*',
        hit_dice: null,
        saving_throws: [],
        caster_type: 'NONE',
        features: [
          { name: 'Improved Critical', desc: 'A Critical Hit on a 19 or 20.', gained_at: [{ level: 3 }] },
        ],
      }),
    ]

    stubSearch(pageOf(records, 2, { class: 2 }))
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'fighter')
    await waitFor(() => expect(screen.getByText('Fighter')).toBeInTheDocument())

    // Both are class records, so one chip covers them -- the row meta tells them apart.
    expect(filters().getByRole('button', { name: /Classes/ })).toHaveTextContent(/^Classes2$/)
    expect(screen.getByRole('button', { name: /Champion/ })).toHaveTextContent('Subclass')
    expect(screen.getByRole('button', { name: /^Fighter/ })).toHaveTextContent('Class')
  })

  it('reads a subclass without pretending it is selectable at level 1', async () => {
    stubSearch(pageOf([
      envelope('class', 'srd-2024_champion', 'Champion', {
        subclass_of: { name: 'Fighter', key: 'srd-2024_fighter' },
        desc: '*Pursue Physical Excellence in Combat*',
        hit_dice: null,
        saving_throws: [],
        caster_type: 'NONE',
        features: [
          { name: 'Survivor', desc: 'Advantage on Death Saving Throws.', gained_at: [{ level: 18 }] },
          { name: 'Improved Critical', desc: 'A Critical Hit on a 19 or 20.', gained_at: [{ level: 3 }] },
        ],
      }),
    ], 1, { class: 1 }))
    render(<SearchPanel onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'champion')
    await waitFor(() => expect(screen.getByText('Champion')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Champion/ }))

    expect(screen.getByText('Subclass of')).toBeInTheDocument()
    expect(screen.getByText('Fighter')).toBeInTheDocument()
    // The level each feature arrives at is what explains why creation cannot offer it.
    expect(screen.getByText(/Improved Critical/)).toHaveTextContent('level 3')
    expect(screen.getByText(/Survivor/)).toHaveTextContent('level 18')
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
