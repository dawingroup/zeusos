/**
 * Integration Test Setup
 * Setup for integration tests with Firebase emulators
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { testEnvManager } from './utils/test-environment';

// Set emulator environment variables BEFORE any Firebase initialization
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Initialize test environment before all tests
beforeAll(async () => {
  console.log('Initializing test environment with Firebase emulators...');
  try {
    await testEnvManager.initialize({ useEmulator: true });
    console.log('Test environment initialized');
  } catch (error) {
    console.error('Failed to initialize test environment:', error);
    throw error;
  }
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  try {
    await testEnvManager.cleanup();
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
  console.log('Test environment cleaned up');
});

// Reset database after each test
afterEach(async () => {
  try {
    await testEnvManager.reset();
  } catch (error) {
    console.warn('Reset warning:', error);
  }
});
