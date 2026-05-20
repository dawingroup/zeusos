/**
 * Vitest Setup File
 * Global setup for all tests
 */

import { afterEach, beforeAll, vi } from 'vitest';

// Mock Firebase
vi.mock('../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => {
  const GoogleAuthProvider = vi.fn(() => ({ addScope: vi.fn() }));
  (GoogleAuthProvider as any).credentialFromResult = vi.fn(() => null);
  return {
    getAuth: vi.fn(() => ({ currentUser: null })),
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    }),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signInAnonymously: vi.fn(),
    GoogleAuthProvider,
  };
});

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
  listAll: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(),
}));

// Setup globals
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

// Global test utilities
(global as any).testTimeout = 30000;
