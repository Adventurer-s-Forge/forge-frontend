import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { AttributionNotice } from "../components/Attribution";
import { CharacterModal } from "../components/character/CharacterModal";
import { Dashboard } from "../pages/Dashboard";
import { Home } from "../pages/Home";
import { sourcesFrom, toSource } from "../data/normalize";
import type { Envelope } from "../lib/api";
import { seedTestCatalog } from "./fixtures";

const authState = vi.hoisted(() => ({
  user: null as null | { uid: string; email: string; displayName: string },
}))

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
}))
vi.mock('../auth/oauth', () => ({
  signInWithProvider: vi.fn(),
  stashPendingCredential: vi.fn(),
  consumePendingCredential: vi.fn(),
}))
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    loading: false,
    refreshUser: vi.fn(),
    redirectError: null,
    clearRedirectError: vi.fn(),
  }),
}))
vi.mock('../characters/useCharacters', () => ({
  useCharacters: () => ({
    characters: [],
    loading: false,
    error: null,
    save: vi.fn(),
    remove: vi.fn(),
  }),
}))

/** The shape /races, /classes and the rest actually send. */
const SRD_DOCUMENT = {
  key: 'srd-2024',
  name: 'System Reference Document 5.2',
  display_name: '5e 2024 Rules',
  publisher: { name: 'Wizards of the Coast' },
  permalink: 'https://dnd.wizards.com/resources/systems-reference-document',
}

const record = (document: string, data: unknown): Envelope<unknown> => ({
  type: 'race',
  key: 'srd-2024_human',
  name: 'Human',
  document,
  data,
})

const srdRecord = record('srd-2024', { document: SRD_DOCUMENT })
/** /skills sends a bare key string here rather than an object. */
const coreRecord = record('core', { document: 'core' })

const signedIn = () => {
  authState.user = { uid: 'u1', email: 'a@b.com', displayName: 'TestName' }
}

beforeAll(seedTestCatalog)

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = null
})

describe('the attribution notice (UT-78)', () => {
  it('names the content source and its publisher', () => {
    render(<AttributionNotice />)
    const notice = screen.getByRole('region', { name: 'Content attribution' })

    expect(notice).toHaveTextContent('System Reference Document 5.2')
    expect(notice).toHaveTextContent('Wizards of the Coast')
  })

  it('names the license and links to the license text', () => {
    render(<AttributionNotice />)

    const license = screen.getByRole('link', {
      name: 'Creative Commons Attribution 4.0 International',
    })

    expect(license).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/legalcode')
  })

  it('says a license is unstated rather than attaching one the records do not carry', () => {
    render(<AttributionNotice />)
    const notice = screen.getByRole('region', { name: 'Content attribution' })

    // The bare 'core' document has no publisher, permalink or license, so it offers no links.
    expect(notice).toHaveTextContent(/does not state/)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('reads the nested document object and the bare key string alike', () => {
    const nested = toSource(srdRecord)
    const bare = toSource(coreRecord)

    expect(nested).toMatchObject({
      key: 'srd-2024',
      name: 'System Reference Document 5.2',
      displayName: '5e 2024 Rules',
      publisher: 'Wizards of the Coast',
    })
    expect(nested.license?.shortName).toBe('CC BY 4.0')
    expect(bare).toMatchObject({ key: 'core', name: 'core', publisher: '', permalink: '', license: null })
  })

  it('credits each document once across every collection', () => {
    const sources = sourcesFrom([[srdRecord, srdRecord], [coreRecord], []])

    expect(sources.map((source) => source.key)).toEqual(['core', 'srd-2024'])
  })
})

describe('reaching the attribution notice (UT-79)', () => {
  it('offers it from the dashboard, exactly once', () => {
    signedIn()
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    const footers = screen.getAllByRole('contentinfo')

    expect(footers).toHaveLength(1)
    expect(within(footers[0]).getByRole('link', { name: /Attribution/ })).toHaveAttribute(
      'href',
      '/attribution',
    )
  })

  it('offers it from the landing page, exactly once', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const footers = screen.getAllByRole('contentinfo')

    expect(footers).toHaveLength(1)
    expect(within(footers[0]).getByRole('link', { name: /Attribution/ })).toBeInTheDocument()
  })

  it('offers it from inside the wizard without navigating away from the draft', () => {
    render(<CharacterModal onSave={vi.fn()} onSearch={vi.fn()} onClose={vi.fn()} />)

    const link = screen.getByRole('link', { name: 'Attribution' })

    // A plain anchor opening a new tab, not a route change -- an unsaved draft survives it.
    expect(link).toHaveAttribute('href', '/attribution')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('reads without signing in', () => {
    render(
      <MemoryRouter initialEntries={['/attribution']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Where the game content comes from' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Content attribution' })).toBeInTheDocument()
  })
})
