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
      // Design-system guard rails (Phase U.1). Warn-only until U.6 promotes
      // to error after the U.2 module-by-module token sweep + U.3 hex
      // eradication. See docs/STYLING.md.
      'design-system/no-raw-palette': 'warn',
      'design-system/no-inline-style-literals': 'warn',
    },
  },
];
