import { useSearchParams } from "react-router"
import { LoginForm } from "../components/LoginForm"

export function Login() {
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin'

  return (
    <main className="screen">
      <LoginForm initialMode={initialMode} />
    </main>
  )
}