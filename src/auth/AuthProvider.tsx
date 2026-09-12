import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { AuthContext } from './AuthContext'
import { consumePendingCredential, stashPendingCredential } from './oauth'
import { authErrorMessage, isUserCancelled } from './errors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: User | null }>({ user: null })
  const [loading, setLoading] = useState(true)
  const [redirectError, setRedirectError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setSession({ user: nextUser })
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
    setSession({ user: auth.currentUser })
  }, [])

  const value = useMemo(
    () => ({
      user: session.user,
      loading,
      refreshUser,
      redirectError,
      clearRedirectError,
    }), 
    [session, loading, refreshUser, redirectError, clearRedirectError, ],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
