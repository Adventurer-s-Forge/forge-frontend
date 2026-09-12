import { useState } from "react";
import type { SubmitEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authErrorMessage } from "../auth/errors";

type Mode = 'signin' | 'signup'

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
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
          {busy ? 'Working...' : isSignup ? 'Create account' : 'Sign in'}
        </button>

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