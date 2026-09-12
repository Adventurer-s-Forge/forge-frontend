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
}

/** Turns a thrown auth error into something worth showing a user. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? `Something went wrong (${error.code}).`
  }
  return 'Something went wrong. Please try again.'
}
