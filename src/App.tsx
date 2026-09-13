import { useAuth } from "./auth/useAuth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="screen">
        <p className="muted">Loading...</p>
      </main>
    )
  }

  return user ? <Dashboard /> : <Login />
}

export default App