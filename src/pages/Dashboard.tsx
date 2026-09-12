import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../auth/useAuth";

export function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="app">
      <header className="topbar">
        <strong>Adverture's Forge</strong>
        <div className="topbar-right">
          <span className="muted">{user?.email}</span>
          <button type="button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        <h1>Dashboard</h1>
        <p className="muted">You're signed in. Nothing here yet.</p>
        <pre className="debug">
          {JSON.stringify(
            { uid: user?.uid, email: user?.email, verified: user?.emailVerified },
            null,
            2,
          )}
        </pre>
      </main>
    </div>
  )
}