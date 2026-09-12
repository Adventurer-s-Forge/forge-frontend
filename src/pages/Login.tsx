import { useState } from "react";
import type { SubmitEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authErrorMessage, isUserCancelled } from "../auth/errors";
import { signInWithGoogle, signInWithGithub } from "../auth/oauth";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";

type Mode = 'signin' | 'signup'
type Pending = 'email' | 'google' | 'github' | null

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  const isSignup = mode === 'signup'
  const busy = pending !== null

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending('email')

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      setError(authErrorMessage(err))
      setPending(null)
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    setPending(provider)

    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithGithub())
    } catch (err) {
      if (!isUserCancelled(err)) setError(authErrorMessage(err))
        setPending(null)
    }
  }

  function switchMode() {
    setMode(isSignup ? 'signin' : 'signup')
    setError(null)
  }

  return (
    <main className="screen">
      <form className="card" onSubmit={handleSubmit}>
        <h1>{isSignup ? 'Create account' : 'Sign in'}</h1>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

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

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={busy}>
          {pending === 'email' ? 'Working...' : isSignup ? 'Create account' : 'Sign in'}
        </button>

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

        <p className="muted">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="link" onClick={switchMode}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </form>
    </main>
  )
}