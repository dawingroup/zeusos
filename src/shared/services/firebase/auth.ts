/**
 * Firebase Auth Service
 * Authentication service utilities
 */

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword as firebaseSignInWithEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth';
import { app } from './config';

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app);

// Initialize Google Auth Provider with required scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');

/**
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  
  // Store Google access token for Drive API
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    localStorage.setItem('googleAccessToken', credential.accessToken);
  }
  
  return result.user;
}

/**
 * Sign in with email and password.
 * Used by the Playwright e2e suite against the Firebase Auth emulator;
 * also available in development for quick login without a Google popup.
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await firebaseSignInWithEmail(auth, email, password);
  return result.user;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  localStorage.removeItem('googleAccessToken');
  await firebaseSignOut(auth);
}

/**
 * Get Google access token for Drive API
 */
export function getGoogleAccessToken(): string | null {
  return localStorage.getItem('googleAccessToken');
}

/**
 * Refresh Google access token via a re-auth popup.
 *
 * IMPORTANT: Must be called from a direct user-gesture handler (click/tap)
 * to avoid popup blockers. Do NOT call from async chains or timers.
 *
 * Returns the fresh token or throws on failure.
 */
export async function refreshGoogleAccessToken(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    localStorage.setItem('googleAccessToken', credential.accessToken);
    return credential.accessToken;
  }
  throw new Error('Failed to obtain Google access token');
}

/**
 * Custom error class to signal that the Drive token has expired
 * and the user needs to click a button to re-authenticate.
 */
export class DriveTokenExpiredError extends Error {
  constructor() {
    super('Google Drive session expired. Tap "Reconnect Drive" to continue.');
    this.name = 'DriveTokenExpiredError';
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export type { User };
