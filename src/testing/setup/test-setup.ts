// ============================================================================
// TEST SETUP
// ZeusOS v2.0 - Testing Strategy
// Global test setup and mocks
// ============================================================================

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock scrollTo
window.scrollTo = vi.fn() as any;

// Mock Firebase
vi.mock('firebase/app', () => {
  // Phase 6.UI tests check `err instanceof FirebaseError` in their
  // routeBrandFn / IWO error paths; without exporting the class here
  // those `instanceof` checks throw on the missing symbol and the
  // catch-block silently bails. A minimal stub class is sufficient —
  // tests build their own errors with `new Error('…')` or
  // `new FirebaseError('…', '…')`. Mirrors the parallel mock in
  // `src/testing/setup.ts` (used by the root `vitest.config.ts`); CI's
  // `test:unit` script uses this config + setup pair instead.
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

// NOTE: `firebase/firestore` is intentionally not re-mocked here. The
// vitest config aliases it to `src/firebase/__mocks__/firestore.ts`,
// which exports the canonical test double (with `arrayUnion`,
// `arrayRemove`, `collectionGroup`, `increment`, and refs that are
// real string values). An inline `vi.mock('firebase/firestore', …)`
// here would override the alias with a stubbier, incomplete mock and
// break suites that rely on those exports — see boqDesignItemLinkService
// and scene.service.designItem tests.

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

// Console error suppression for expected errors in tests
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
      args[0].includes('Warning: An update to') ||
      args[0].includes('act(...)'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
