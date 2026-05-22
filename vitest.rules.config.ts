/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

// Firestore-rules unit tests. Spawns @firebase/rules-unit-testing against
// the running Firestore emulator (port 8080 per firebase.json). Tests live
// under src/testing/rules/.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/testing/rules/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'functions'],
    testTimeout: 30000,
    hookTimeout: 30000,
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
