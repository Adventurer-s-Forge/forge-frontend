import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authErrorMessage } from "../auth/errors";
import { useAuth } from "../auth/useAuth";
import { Wordmark } from "../components/Wordmark";

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
    <div className="app-shell">
      <header className="app-bar">
        <Wordmark to="/dashboard" />
        <div className="app-bar-right">
          <span className="app-bar-user">{user?.displayName ?? user?.email}</span>
          <button type="button" className="btn btn-quiet" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-head">
          <h1>Your characters</h1>
          <button type="button" className="btn btn-primary">
            New character
          </button>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="empty">
          <p className="empty-title">No characters yet.</p>
          <p className="empty-body">
            Start with a race and class and the Forge will walk you through the rest - abilities, background, proficiency
            and equipment.
          </p>
          <button type="button" className="btn btn-primary">
            Forge your first character
          </button>
        </div>
      </main>
    </div>
  )
}