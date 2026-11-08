import { render, screen, waitFor } from "@testing-library/react";
import userEvent from '@testing-library/user-event';
import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "../pages/Login";
import { MemoryRouter } from "react-router";

const fb = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}))

const oauth = vi.hoisted(() => ({
  signInWithProvider: vi.fn(),
  stashPendingCredential: vi.fn(),
  consumePendingCredential: vi.fn()
}))

vi.mock('../lib/firebase', () => ({ auth: {}, app: {} }))
vi.mock('firebase/auth', () => fb)
vi.mock('../auth/oauth', () => oauth)
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    refreshUser: vi.fn(),
    redirectError: null,
    clearRedirectError: vi.fn(),
  }),
}))

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fb.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1' } })
    fb.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1' } })
    oauth.consumePendingCredential.mockResolvedValue(null)
  })

  it('signs in with the email and password entered', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password6')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      'a@b.com',
      'password6',
    )
  })

  it('refuses to register when the two passwords differ', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create one' }))

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password6')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password7')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passwords do not match.',
    )
    expect(fb.createUserWithEmailAndPassword).not.toHaveBeenCalled()
  })

  it('sets a display name when one is given at signup', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create one' }))

    await userEvent.type(screen.getByLabelText('Name'), 'TestName')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password6')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password6')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(fb.updateProfile).toHaveBeenCalledWith(
        { uid: 'u1' },
        { displayName: 'TestName' },
      ),
    )
  })

  it('sends a reset link without revealing whether the account exists', async () => {
    fb.sendPasswordResetEmail.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(fb.sendPasswordResetEmail).toHaveBeenCalledWith({}, 'a@b.com')
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists',
    )
  })

  it('turns a Firebase error code into a readable message', async () => {
    fb.signInWithEmailAndPassword.mockRejectedValue(
      new FirebaseError('auth/invalid-credential', 'raw')
    )
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.',
    )
  })

  it('rejects a password under 8 characters inline and keeps submit disabled', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create one' }))

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'passwrd')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'passwrd')

    // No submit click: typing alone has to produce the message.
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), 'password')
    await userEvent.clear(screen.getByLabelText('Confirm password'))
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    expect(fb.createUserWithEmailAndPassword).not.toHaveBeenCalled()
  })

  it('does not hold the 8 character rule against a returning account', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'old6')

    // An account made under the old 6 character minimum must still be able to sign in.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'a@b.com', 'old6')
  })

  it('keeps quiet when the user closes the provider popup', async () => {
    oauth.signInWithProvider.mockRejectedValue(
      new FirebaseError('auth/popup-closed-by-user', 'raw')
    )
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /Google/ }))

    await waitFor(() =>
      expect(oauth.signInWithProvider).toHaveBeenCalledWith('google'),  
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})