/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'functions',
      '**/node_modules/**',
      'src/extensions/**/node_modules/**',
      // Integration + rules tests require Firebase emulators — run separately
      // with `npm run test:rules` (vitest.rules.config.ts).
      'src/testing/migration/**',
      'src/testing/performance/**',
      'src/testing/integration/**',
      'src/testing/rules/**',
      // These tests call real Firestore-dependent services and need emulators
      'src/subsidiaries/advisory/matflow/services/__tests__/auto-po-generation.test.ts',
      'src/subsidiaries/advisory/matflow/services/__tests__/po-delivery-tracking.test.ts',
      'src/subsidiaries/advisory/matflow/services/__tests__/po-integration.test.ts',
      'src/subsidiaries/advisory/delivery/core/services/__tests__/accountability-po-validation.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/testing/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'firebase/firestore': path.resolve(__dirname, './src/firebase/__mocks__/firestore.ts'),
    },
  },
});
