import { useState } from "react";
import type { SubmitEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { authErrorMessage, isUserCancelled } from "../auth/errors";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import {
  consumePendingCredential,
  signInWithProvider,
  stashPendingCredential,
} from "../auth/oauth";
import type { ProviderId } from "../auth/oauth";
import { useAuth } from "../auth/useAuth";

type Mode = 'signin' | 'signup' | 'reset'
type Pending = 'email' | 'reset' | ProviderId | null

export function Login() {
  const { refreshUser, redirectError, clearRedirectError } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  const isSignup = mode === 'signup'
  const isReset = mode === 'reset'
  const busy = pending !== null

  const shownError = error ?? redirectError

  function resetFeedback() {
    setError(null)
    setNotice(null)
    clearRedirectError()
  }

  function go(next: Mode) {
    setMode(next)
    setConfirm('')
    resetFeedback()
  }

  async function handleReset() {
    setPending('reset')
    try {
      await sendPasswordResetEmail(auth, email)
      setNotice(`If an account exists for ${email}, a reset link is on its way.`)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setPending(null)
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    resetFeedback()

    if (isReset) return handleReset()

    if (isSignup && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    
    setPending('email')
    try {
      const credential = isSignup
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password)

      if (isSignup) {
        const displayName = name.trim()
        if (displayName) {
          await updateProfile(credential.user, { displayName })
          await refreshUser()
        }
      }

      await consumePendingCredential(credential.user)
    } catch (err) {
      setError(authErrorMessage(err))
      setPending(null)
    }
  }

  async function handleOAuth(id: ProviderId) {
    resetFeedback()
    setPending(id)

    try {
      const credential = await signInWithProvider(id)
      if (credential) await consumePendingCredential(credential.user)
    } catch (err) {
      stashPendingCredential(err)
      if (!isUserCancelled(err)) setError(authErrorMessage(err))
      setPending(null)
    }
  }

  const heading = isReset
    ? 'Reset password'
    : isSignup
      ? 'Create account'
      : 'Sign in'

  return (
    <main className="screen">
      <form className="card" onSubmit={handleSubmit}>
        <h1>{heading}</h1>

        {isReset && (
          <p className="muted">
            Enter your email and we'll send you a link to set a new password.
          </p>
        )}

        {isSignup && (
          <>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {!isReset && (
          <>
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}

        {isSignup && (
          <>
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) =>setConfirm(e.target.value)}
            />
          </>
        )}

        {shownError && (
          <p className="error" role="alert">
            {shownError}
          </p>
        )}

        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        <button type="submit" className="primary" disabled={busy}>
          {pending === 'email' || pending === 'reset' ? 'Working...' : heading}
        </button>

        {!isReset && (
          <>
            <div className="divider">
              <span>or continue with</span>
            </div>

            <div className="oauth">
              <button type="button" className="oauth-btn" disabled={busy} onClick={() => handleOAuth('google')}>
                <FcGoogle size={18} />
                {pending === 'google' ? 'Opening...' : 'Google'}
              </button>

              <button type="button" className="oauth-btn" disabled={busy} onClick={() => handleOAuth('github')}>
                <FaGithub size={18} />
                {pending === 'github' ? 'Opening...' : 'GitHub'}
              </button>
            </div>
          </>
        )}

        <p className="muted">
          {isReset ? (
            <button type="button" className="link" onClick={() => go('signin')}>
              Back to sign in
            </button>
          ) : (
            <>
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" className="link" onClick={() => go(isSignup ? 'signin' : 'signup')}>
                {isSignup ? 'Sign in' : 'Create one'}
              </button>
              {!isSignup && (
                <>
                  {' · '}
                  <button type="button" className="link" onClick={() => go('reset')}>
                    Forgot password?
                  </button>
                </>
              )}
            </>
          )}
        </p>
      </form>
    </main>
  )
}