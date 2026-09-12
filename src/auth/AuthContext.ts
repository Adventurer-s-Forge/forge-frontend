import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthState = {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
  redirectError: string | null
  clearRedirectError: () => void
}

export const AuthContext = createContext<AuthState | undefined>(undefined)