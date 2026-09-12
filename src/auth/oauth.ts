import { FirebaseError } from "firebase/app";
import { 
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithPopup,
  signInWithRedirect
} from "firebase/auth";
import type { AuthCredential, User, UserCredential } from "firebase/auth";
import { auth } from "../lib/firebase";

export type ProviderId = 'google' | 'github'

const google = new GoogleAuthProvider()
const github = new GithubAuthProvider()

google.setCustomParameters({ prompt: 'select_account' })

const providers = { google, github }

const popupUnavailable = new Set([
  'auth/popup-blocked',
  'auth/operatrion-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
])

export async function signInWithProvider(
  id: ProviderId,
): Promise<UserCredential | null> {
  const provider = providers[id]

  try {
    return await signInWithPopup(auth, provider)
  } catch (error) {
    if (error instanceof FirebaseError && popupUnavailable.has(error.code)) {
      await signInWithRedirect(auth, provider)
      return null
    }
    throw error
  }
}

let pendingCredential: AuthCredential | null = null

export function stashPendingCredential(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return false
  if (error.code !== 'auth/account-exists-with-different-credential') return false

  pendingCredential = 
    GoogleAuthProvider.credentialFromError(error) ??
    GithubAuthProvider.credentialFromError(error)

  return pendingCredential !== null
}

export async function consumePendingCredential(user: User): Promise<void> {
  if (!pendingCredential) return

  const credential = pendingCredential
  pendingCredential = null
  
  try {
    await linkWithCredential(user, credential)
  } catch {
    
  }
}