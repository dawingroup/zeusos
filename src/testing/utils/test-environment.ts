/**
 * Test Environment Manager
 * Manages test environment setup, cleanup, and utilities
 */

import {
  Firestore,
  collection,
  doc,
  getDocs,
  writeBatch,
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { testConfig, testCollections } from '../config/test.config';

export interface TestContext {
  db: Firestore;
  userId: string;
  role: string;
  claims: Record<string, any>;
}

export class TestEnvironmentManager {
  private static instance: TestEnvironmentManager;
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private initialized = false;
  private useEmulator = true;

  private constructor() {}

  static getInstance(): TestEnvironmentManager {
    if (!TestEnvironmentManager.instance) {
      TestEnvironmentManager.instance = new TestEnvironmentManager();
    }
    return TestEnvironmentManager.instance;
  }

  /**
   * Initialize test environment
   */
  async initialize(options?: { useEmulator?: boolean }): Promise<Firestore> {
    if (this.db && this.initialized) {
      return this.db;
    }

    this.useEmulator = options?.useEmulator ?? true;

    // Initialize Firebase app for testing
    this.app = initializeApp({
      projectId: testConfig.projectId,
      apiKey: 'test-api-key',
      authDomain: `${testConfig.projectId}.firebaseapp.com`,
    }, `test-app-${Date.now()}`);

    this.db = getFirestore(this.app);

    // Connect to emulator if enabled
    if (this.useEmulator) {
      try {
        connectFirestoreEmulator(
          this.db,
          testConfig.emulatorHost,
          testConfig.emulatorPorts.firestore
        );
      } catch (error) {
        // Emulator may already be connected
        console.warn('Firestore emulator connection warning:', error);
      }
    }

    this.initialized = true;
    return this.db;
  }

  /**
   * Get Firestore instance
   */
  getFirestore(): Firestore {
    if (!this.db) {
      throw new Error('Test environment not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Create authenticated test context
   */
  createAuthenticatedContext(
    userId: string,
    role: string = 'user',
    claims: Record<string, any> = {}
  ): TestContext {
    if (!this.db) {
      throw new Error('Test environment not initialized');
    }

    return {
      db: this.db,
      userId,
      role,
      claims: { role, ...claims },
    };
  }

  /**
   * Create unauthenticated test context
   */
  createUnauthenticatedContext(): TestContext {
    if (!this.db) {
      throw new Error('Test environment not initialized');
    }

    return {
      db: this.db,
      userId: '',
      role: 'anonymous',
      claims: {},
    };
  }

  /**
   * Clear all test data from Firestore
   */
  async clearFirestore(): Promise<void> {
    if (!this.db) {
      throw new Error('Test environment not initialized');
    }

    const collectionsToClean = Object.values(testCollections);

    for (const collectionName of collectionsToClean) {
      await this.clearCollection(collectionName);
    }
  }

  /**
   * Clear a specific collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    if (!this.db) {
      console.warn('Firestore instance not initialized, skipping collection clear');
      return;
    }

    try {
      const collectionRef = collection(this.db, collectionName);
      const snapshot = await getDocs(collectionRef);

      // Check if snapshot is valid
      if (!snapshot) {
        console.warn(`Failed to get snapshot for collection ${collectionName}: snapshot is null/undefined`);
        return;
      }

      if (snapshot.empty) {
        return;
      }

      const batch = writeBatch(this.db);
      let count = 0;

      for (const docSnapshot of snapshot.docs) {
        batch.delete(docSnapshot.ref);
        count++;

        // Commit batch every 500 docs (Firestore limit)
        if (count >= 500) {
          await batch.commit();
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.warn(`Failed to clear collection ${collectionName}:`, error);
      // Don't throw - allow tests to continue
    }
  }

  /**
   * Seed test data
   */
  async seedData<T extends { id: string }>(
    collectionName: string,
    data: T[]
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Test environment not initialized');
    }

    const batch = writeBatch(this.db);
    let count = 0;

    for (const item of data) {
      const docRef = doc(this.db, collectionName, item.id);
      batch.set(docRef, item);
      count++;

      if (count >= 500) {
        await batch.commit();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanup(): Promise<void> {
    if (this.db) {
      await this.clearFirestore();
    }

    this.db = null;
    this.app = null;
    this.initialized = false;
  }

  /**
   * Check if environment is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset environment (clear data but keep connection)
   */
  async reset(): Promise<void> {
    await this.clearFirestore();
  }
}

export const testEnvManager = TestEnvironmentManager.getInstance();

/**
 * Test helper functions
 */

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Assert that a promise rejects
 */
export async function assertRejects(
  promise: Promise<any>,
  errorMessage?: string
): Promise<Error> {
  try {
    await promise;
    throw new Error(errorMessage || 'Expected promise to reject');
  } catch (error) {
    if (error instanceof Error && error.message === (errorMessage || 'Expected promise to reject')) {
      throw error;
    }
    return error as Error;
  }
}

/**
 * Assert that a promise resolves
 */
export async function assertSucceeds<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw new Error(`Expected promise to succeed, but it rejected: ${error}`);
  }
}
