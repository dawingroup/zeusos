import { vi } from 'vitest';

// Create individually exported mocks for easy test access
export const connectFirestoreEmulator = vi.fn();
export const getFirestore = vi.fn(() => ({}));
export const initializeFirestore = vi.fn(() => ({}));
export const persistentLocalCache = vi.fn(() => ({}));
export const persistentMultipleTabManager = vi.fn(() => ({}));
export const collection = vi.fn(() => 'mock-collection-ref');
export const doc = vi.fn(() => 'mock-doc-ref');
export const getDoc = vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined, id: '' }));
export const getDocs = vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() }));
export const setDoc = vi.fn();
export const addDoc = vi.fn(() => Promise.resolve({ id: 'new-doc-id' }));
export const updateDoc = vi.fn();
export const deleteDoc = vi.fn();

export const writeBatch = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(() => Promise.resolve()),
}));

export const query = vi.fn(() => 'mock-query');
export const where = vi.fn(() => 'mock-where');
export const orderBy = vi.fn(() => 'mock-orderBy');
export const limit = vi.fn(() => 'mock-limit');
export const startAt = vi.fn();
export const startAfter = vi.fn();
export const endAt = vi.fn();
export const endBefore = vi.fn();
export const onSnapshot = vi.fn();
export const serverTimestamp = vi.fn(() => ({ _serverTimestamp: true }));
export const increment = vi.fn((n: number) => ({ _increment: n }));
export const arrayUnion = vi.fn((...values: unknown[]) => ({ _arrayUnion: values }));
export const arrayRemove = vi.fn((...values: unknown[]) => ({ _arrayRemove: values }));
export const collectionGroup = vi.fn(() => 'mock-collection-group-ref');

export const Timestamp = {
  now: vi.fn(() => ({
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
  })),
  fromDate: vi.fn((date: Date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  })),
  fromMillis: vi.fn((millis: number) => ({
    toDate: () => new Date(millis),
    toMillis: () => millis,
    seconds: Math.floor(millis / 1000),
    nanoseconds: 0,
  })),
};

// Helper to reset all mocks - can be called in beforeEach
export function resetFirestoreMocks() {
  connectFirestoreEmulator.mockClear();
  getFirestore.mockClear();
  collection.mockClear();
  doc.mockClear();
  getDoc.mockClear();
  getDocs.mockClear();
  setDoc.mockClear();
  addDoc.mockClear();
  updateDoc.mockClear();
  deleteDoc.mockClear();
  query.mockClear();
  where.mockClear();
  orderBy.mockClear();
  limit.mockClear();
  startAt.mockClear();
  startAfter.mockClear();
  endAt.mockClear();
  endBefore.mockClear();
  onSnapshot.mockClear();
  serverTimestamp.mockClear();
}
