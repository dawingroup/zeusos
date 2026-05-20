/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/testing/setup.integration.ts'],
    include: ['src/testing/migration/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'functions'],
    testTimeout: 300000, // 5 minutes for migration tests
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: {
      shuffle: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
