/**
 * Vitest Configuration for Purchase Order Enhancement Tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test file patterns
    include: [
      'src/subsidiaries/advisory/**/services/__tests__/**/*.test.ts',
      'src/subsidiaries/advisory/**/services/__tests__/po-*.test.ts',
      'src/subsidiaries/advisory/**/services/__tests__/accountability-*.test.ts',
      'src/subsidiaries/advisory/**/services/__tests__/auto-*.test.ts'
    ],

    // Environment
    environment: 'node',

    // Globals
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: [
        'src/subsidiaries/advisory/matflow/services/procurement-service.ts',
        'src/subsidiaries/advisory/matflow/services/requisition-service.ts',
        'src/subsidiaries/advisory/matflow/services/auto-po-generation.service.ts',
        'src/subsidiaries/advisory/delivery/core/services/enhanced-accountability.service.ts'
      ],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85
      },
      reporter: ['text', 'lcov', 'html']
    },

    // Timeout for async operations
    testTimeout: 15000,

    // Setup files
    setupFiles: [],

    // Reporter
    reporters: ['default', 'verbose'],

    // Pool options
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false
      }
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@subsidiaries': path.resolve(__dirname, './src/subsidiaries'),
      '@matflow': path.resolve(__dirname, './src/subsidiaries/advisory/matflow'),
      '@delivery': path.resolve(__dirname, './src/subsidiaries/advisory/delivery')
    }
  }
});
