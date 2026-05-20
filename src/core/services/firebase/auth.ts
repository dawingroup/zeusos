/**
 * Firebase Auth Service
 * Authentication service utilities
 */

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
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
googleProvider.addScope('https://www.googleapis.com/auth/documents');

// In-memory storage for Google access token (more secure than localStorage)
// This token will be cleared on page refresh, which is acceptable for Drive API usage
let googleAccessTokenCache: { token: string; expiry: number } | null = null;

/**
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);

  // Store Google access token in memory (not localStorage to prevent XSS exfiltration)
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    // Google OAuth tokens typically expire in 1 hour
    googleAccessTokenCache = {
      token: credential.accessToken,
      expiry: Date.now() + 3600 * 1000, // 1 hour
    };
  }

  return result.user;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  // Clear in-memory token cache
  googleAccessTokenCache = null;
  await firebaseSignOut(auth);
}

/**
 * Sign in anonymously for public portal access
 * Used by CD Portal to satisfy Firestore auth requirements without user interaction
 */
export async function signInAnonymouslyForPortal(): Promise<User> {
  // If already signed in (anonymous or otherwise), return current user
  if (auth.currentUser) {
    return auth.currentUser;
  }
  const result = await signInAnonymously(auth);
  return result.user;
}

/**
 * Get Google access token for Drive API
 * Returns null if token is expired or not available
 * For extended sessions, re-authentication may be needed
 */
export function getGoogleAccessToken(): string | null {
  if (!googleAccessTokenCache) {
    return null;
  }

  // Check if token is expired
  if (Date.now() >= googleAccessTokenCache.expiry) {
    googleAccessTokenCache = null;
    return null;
  }

  return googleAccessTokenCache.token;
}

/**
 * Check if Google access token is available and valid
 */
export function hasValidGoogleToken(): boolean {
  return getGoogleAccessToken() !== null;
}

/**
 * Refresh the Google access token by re-authenticating via popup.
 * Call this when the token has expired instead of requiring full sign-out/sign-in.
 * Returns the new access token, or null if the user cancels.
 */
export async function refreshGoogleToken(): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      googleAccessTokenCache = {
        token: credential.accessToken,
        expiry: Date.now() + 3600 * 1000,
      };
      return credential.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export type { User };
