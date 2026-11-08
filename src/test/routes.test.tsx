import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { PublicOnlyRoute } from "../routes/PublicOnlyRoute";

const session = vi.hoisted(() => ({
  user: null as { uid: string } | null,
  loading: false,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: session.user,
    loading: session.loading,
    refreshUser: vi.fn(),
    redirectError: null,
    clearRedirectError: vi.fn(),
  }),
}))

/** Each guard wraps the other's destination, so a redirect is followed all the way to the page
 * it lands on. Asserting on a stubbed <Navigate> would pass even if the target were unreachable. */
function renderAt(pathname: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname, state }]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<p>the dashboard</p>} />
          <Route path="/characters/7" element={<p>character seven</p>} />
        </Route>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<p>the login page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const SIGNED_IN = { uid: 'u1' }

beforeEach(() => {
  session.user = null
  session.loading = false
})

describe('ProtectedRoute (US-15)', () => {
  it('renders the page it guards for a signed in user', () => {
    session.user = SIGNED_IN
    renderAt('/dashboard')

    expect(screen.getByText('the dashboard')).toBeInTheDocument()
  })

  it('sends a signed out visitor to the login page instead', () => {
    renderAt('/dashboard')

    expect(screen.getByText('the login page')).toBeInTheDocument()
    expect(screen.queryByText('the dashboard')).not.toBeInTheDocument()
  })

  it('waits rather than redirecting while the session is still resolving', () => {
    session.loading = true
    renderAt('/dashboard')

    expect(screen.getByRole('status')).toHaveTextContent('Rolling')
    expect(screen.queryByText('the dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('the login page')).not.toBeInTheDocument()
  })
})

describe('PublicOnlyRoute (US-15, US-17)', () => {
  it('renders the login page for a signed out visitor', () => {
    renderAt('/login')

    expect(screen.getByText('the login page')).toBeInTheDocument()
  })

  it('keeps a signed in user off the login page', () => {
    session.user = SIGNED_IN
    renderAt('/login')

    expect(screen.getByText('the dashboard')).toBeInTheDocument()
    expect(screen.queryByText('the login page')).not.toBeInTheDocument()
  })

  it('returns a signed in user to the page that sent them to log in', () => {
    session.user = SIGNED_IN
    renderAt('/login', { from: { pathname: '/characters/7' } })

    expect(screen.getByText('character seven')).toBeInTheDocument()
  })

  it('falls back to the dashboard when the redirect state names no page', () => {
    session.user = SIGNED_IN
    renderAt('/login', { from: {} })

    expect(screen.getByText('the dashboard')).toBeInTheDocument()
  })

  it('waits rather than redirecting while the session is still resolving', () => {
    session.loading = true
    renderAt('/login')

    expect(screen.getByRole('status')).toHaveTextContent('Rolling')
    expect(screen.queryByText('the login page')).not.toBeInTheDocument()
  })
})
