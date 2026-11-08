import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthModal } from "../components/AuthModal";
import { NotFound } from "../pages/NotFound";

const fb = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}))

const oauth = vi.hoisted(() => ({
  signInWithProvider: vi.fn(),
  stashPendingCredential: vi.fn(),
  consumePendingCredential: vi.fn(),
}))

const session = vi.hoisted(() => ({ user: null as { uid: string } | null }))

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))
vi.mock('firebase/auth', () => fb)
vi.mock('../auth/oauth', () => oauth)
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: session.user,
    loading: false,
    refreshUser: vi.fn(),
    redirectError: null,
    clearRedirectError: vi.fn(),
  }),
}))

const show = (onClose: () => void, mode: 'signin' | 'signup' = 'signin') =>
  render(
    <MemoryRouter>
      <AuthModal initialMode={mode} onClose={onClose} />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  session.user = null
  oauth.consumePendingCredential.mockResolvedValue(null)
})

describe('AuthModal (US-13, US-15)', () => {
  it('opens as a modal dialog holding the sign in form', () => {
    show(vi.fn())

    expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('opens on the mode it was asked for', () => {
    show(vi.fn(), 'signup')

    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('closes when the close button is pressed', async () => {
    const onClose = vi.fn()
    show(onClose)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on escape without letting the dialog cancel on its own', async () => {
    const onClose = vi.fn()
    show(onClose)

    const dialog = screen.getByRole('dialog', { name: 'Account' })
    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    dialog.dispatchEvent(cancel)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(cancel.defaultPrevented).toBe(true)
  })

  it('closes when the backdrop itself is clicked', async () => {
    const onClose = vi.fn()
    show(onClose)

    await userEvent.click(screen.getByRole('dialog', { name: 'Account' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the click lands inside the panel', async () => {
    const onClose = vi.fn()
    show(onClose)

    await userEvent.click(screen.getByLabelText(/email/i))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes itself once a user is signed in', async () => {
    const onClose = vi.fn()
    session.user = { uid: 'u1' }
    show(onClose)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

describe('NotFound', () => {
  it('names the status and offers a way back to the entrance', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Nothing down this corridor/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to the entrance/ })).toHaveAttribute('href', '/')
  })
})
