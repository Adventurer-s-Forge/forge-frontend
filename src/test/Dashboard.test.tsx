import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../pages/Dashboard";
import { MemoryRouter } from "react-router";
import { createDraft, type Character } from "../characters/character";

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