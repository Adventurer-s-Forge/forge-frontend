import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authErrorMessage } from "../auth/errors";
import { useAuth } from "../auth/useAuth";

export function Dashboard() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setError(null)
    setSigningOut(true)

    try {
      await signOut(auth)
    } catch (err) {
      setError(authErrorMessage(err))
      setSigningOut(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong>Adventure's Forge</strong>
        <div className="topbar-right">
          <span className="muted">{user?.displayName ?? user?.email}</span>
          <button type="button" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="content">
        <h1>Dashboard</h1>
        <p className="muted">You're signed in. Nothing here yet.</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  )
}