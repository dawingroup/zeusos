// ============================================================================
// VITEST CONFIGURATION
// ZeusOS v2.0 - Testing Strategy
// Comprehensive test runner configuration
// ============================================================================

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()] as any,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup/test-setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/testing/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      // Integration tests require Firebase emulators
      'src/testing/migration/**',
      'src/testing/performance/**',
      'src/testing/integration/**',
      // These tests call real Firestore-dependent services and need emulators
      'src/subsidiaries/advisory/matflow/services/__tests__/auto-po-generation.test.ts',
      'src/subsidiaries/advisory/matflow/services/__tests__/po-delivery-tracking.test.ts',
      'src/subsidiaries/advisory/matflow/services/__tests__/po-integration.test.ts',
      'src/subsidiaries/advisory/delivery/core/services/__tests__/accountability-po-validation.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/testing/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    reporters: ['verbose', 'html', 'json'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/report.html',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../'),
      '@testing': path.resolve(__dirname, '../'),
      '@modules': path.resolve(__dirname, '../../modules'),
      '@shared': path.resolve(__dirname, '../../shared'),
      'firebase/firestore': path.resolve(__dirname, '../../firebase/__mocks__/firestore.ts'),
    },
  },
});
