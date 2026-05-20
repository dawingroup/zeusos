/**
 * Firebase configuration and initialization
 * Dawin Clipper - Separate Firebase project from cutlist-processor
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth';

// Firebase config from environment variables (set in .env file)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Load config from chrome.storage.sync
export async function loadFirebaseConfig(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(['firebaseConfig']);
    if (result.firebaseConfig) {
      Object.assign(firebaseConfig, result.firebaseConfig);
    }
  } catch (error) {
    console.error('Failed to load Firebase config:', error);
  }
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

/**
 * Initialize Firebase (lazy initialization)
 */
export function initializeFirebase(): { app: FirebaseApp; db: Firestore; storage: FirebaseStorage; auth: Auth } {
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
  }
  return { app, db: db!, storage: storage!, auth: auth! };
}

/**
 * Get Firestore instance
 */
export function getDb(): Firestore {
  if (!db) initializeFirebase();
  return db!;
}

/**
 * Get Storage instance
 */
export function getStorageInstance(): FirebaseStorage {
  if (!storage) initializeFirebase();
  return storage!;
}

/**
 * Get Auth instance
 */
export function getAuthInstance(): Auth {
  if (!auth) initializeFirebase();
  return auth!;
}

/**
 * Sign in with Chrome Identity token
 */
export async function signInWithChromeIdentity(): Promise<User | null> {
  try {
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token: any) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (token) {
          resolve(token);
        } else {
          reject(new Error('No token received'));
        }
      });
    });

    const credential = GoogleAuthProvider.credential(null, token);
    const authInstance = getAuthInstance();
    const result = await signInWithCredential(authInstance, credential);
    return result.user;
  } catch (error) {
    console.error('Chrome identity sign-in failed:', error);
    return null;
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const authInstance = getAuthInstance();
  await authInstance.signOut();
  
  // Also revoke Chrome identity token
  chrome.identity.getAuthToken({ interactive: false }, (token: any) => {
    if (token) {
      chrome.identity.removeCachedAuthToken({ token });
    }
  });
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  const authInstance = getAuthInstance();
  return authInstance.currentUser;
}

// Re-export Firestore utilities
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
};
