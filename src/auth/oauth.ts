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
import { authErrorMessage } from "./errors";

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

const benignLinkErrors = new Set(['auth/provider-already-linked'])

export async function consumePendingCredential(user: User): Promise<string | null> {
  if (!pendingCredential) return null

  const credential = pendingCredential
  pendingCredential = null
  
  try {
    await linkWithCredential(user, credential)
    return null
  } catch (error) {
    if (error instanceof FirebaseError && benignLinkErrors.has(error.code)) {
      return null
    }
    console.error('Could not link pending credential', error)
    return authErrorMessage(error)
  }
}