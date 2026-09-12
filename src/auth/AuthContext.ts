import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthState = {
  /** The signed-in user, or null when signed out. */
  user: User | null
  /** True until Firebase has restored (or ruled out) a persisted session. */
  loading: boolean
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
