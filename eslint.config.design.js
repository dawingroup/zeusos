/**
 * Focused ESLint config for the design-system rules only.
 *
 * Run via `npm run lint:design`. Loads only the two custom rules from
 * .eslint/ — no TypeScript/React/etc rules — so the output is a clean
 * channel for design-system violations without drowning in the broader
 * 6k-problem lint backlog.
 *
 * Promoted to 'error' in Phase U.6 (PR #77) after lint:design hit 0/0
 * codebase-wide. New violations now fail this focused channel + the main
 * lint config. See docs/STYLING.md + UI_QA_REPORT.md.
 */

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import designSystem from './.eslint/index.js';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.eslintrc.cjs',
      'zeusos-mcp-server/**',
      'functions/**',
      'e2e/**',
      'scripts/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    // @typescript-eslint is loaded so that existing
    // /* eslint-disable @typescript-eslint/... */ directives in source files
    // resolve under ESLint v9. No rules from it are enabled — this config's
    // job is to surface design-system violations ONLY.
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'design-system': designSystem,
    },
    rules: {
      'design-system/no-raw-palette': 'error',
      'design-system/no-inline-style-literals': 'error',
    },
  },
];
