import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../pages/Dashboard";
import { MemoryRouter } from "react-router";

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

describe('Dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

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
})