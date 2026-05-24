import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import designSystem from './.eslint/index.js';

export default [
  {
    ignores: ['dist/**', '.eslintrc.cjs'],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.cjs', 'scripts/**/*.js', '*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'design-system': designSystem,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Design-system guard rails. Promoted to 'error' in U.6 (PR #77)
      // after the U.2 module token sweeps + U.3 sentiment sweeps + U.3.f
      // hex eradication brought lint:design to 0/0 codebase-wide. New
      // violations now block CI. See docs/STYLING.md + UI_QA_REPORT.md.
      'design-system/no-raw-palette': 'error',
      'design-system/no-inline-style-literals': 'error',
    },
  },
];
