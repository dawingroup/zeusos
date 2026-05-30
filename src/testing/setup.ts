/**
 * Vitest Setup File
 * Global setup for all tests
 */

import { afterEach, beforeAll, vi } from 'vitest';

// jsdom in this config does not provide a working localStorage (the
// `--localstorage-file` flag is unset), so anything backed by zustand's
// `persist` middleware (e.g. uiStore) throws "storage.setItem is not a
// function" on first write. Install a minimal in-memory polyfill at module
// load — before any store module initialises createJSONStorage(localStorage).
if (
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage.setItem !== 'function'
) {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => {
        mem.clear();
      },
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      get length() {
        return mem.size;
      },
    },
  });
}

// Mock Firebase
vi.mock('../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/app', () => {
  // Phase 6.UI tests check `err instanceof FirebaseError` in their
  // routeBrandFn / IWO error paths; without exporting the class here
  // those `instanceof` checks throw on the missing symbol and the
  // catch-block silently bails. A minimal stub class is sufficient —
  // tests build their own errors with `new Error('…')`.
  class FirebaseError extends Error {
    code: string;
    customData?: Record<string, unknown>;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'FirebaseError';
      this.code = code;
    }
  }
  return {
    initializeApp: vi.fn(() => ({})),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => ({})),
    FirebaseError,
  };
});

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
