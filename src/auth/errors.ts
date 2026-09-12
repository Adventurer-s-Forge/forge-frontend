import { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/invalid-email': 'That email address looks malformed.',
  'auth/missing-password': 'Enter a password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/email-already-in-use': 'An account already exists for that email.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'Network error — check your connection.',
  'auth/operation-not-allowed':
    'Email/password sign-in is disabled for this Firebase project.',
  'auth/account-exists-with-different-credential':
    'That email is already registered with a different sign-in method. ' +
    'Sign in the way you did originally and we will link the two.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup.',
  'auth/unauthorized-domain':
    'This domain is not in the Firebase authorized domains list.',
  'auth/requires-recent-login': 'Please sign in again to continue',
  'auth/missing-email': 'Enter your email address.'
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? `Something went wrong (${error.code}).`
  }
  return 'Something went wrong. Please try again.'
}

export function isUserCancelled(error: unknown): boolean {
  return (
    error instanceof FirebaseError &&
    (error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request' ||
      error.code === 'auth/user-cancelled')
  )
}