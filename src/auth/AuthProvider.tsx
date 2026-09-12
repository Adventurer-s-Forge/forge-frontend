import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { AuthContext } from './AuthContext'
import { consumePendingCredential, stashPendingCredential } from './oauth'
import { authErrorMessage, isUserCancelled } from './errors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const [redirectError, setRedirectError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    getRedirectResult(auth)
      .then((credential) => {
        if (!credential) return
        return consumePendingCredential(credential.user)
      })
      .then((linkFailure) => {
        if (linkFailure) setRedirectError(linkFailure)
      })
    .catch((error) => {
      stashPendingCredential(error)
      if (!isUserCancelled(error)) setRedirectError(authErrorMessage(error))
    })
  }, [])

  const clearRedirectError = useCallback(() => setRedirectError(null), [])

  const refreshUser = useCallback(async () => {
    await auth.currentUser?.reload()
    setUser(auth.currentUser)
    setNonce((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ user, loading, refreshUser, redirectError, clearRedirectError }), 
    [user, loading, refreshUser, redirectError, clearRedirectError, nonce],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
