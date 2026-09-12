import { 
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithPopup 
} from "firebase/auth";
import type { UserCredential } from "firebase/auth";
import { auth } from "../lib/firebase";

const google = new GoogleAuthProvider()
const github = new GithubAuthProvider()

google.setCustomParameters({ prompt: 'select_account' })

export function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, google)
}

export function signInWithGithub(): Promise<UserCredential> {
  return signInWithPopup(auth, github)
}