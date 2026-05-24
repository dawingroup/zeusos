/**
 * design-system ESLint plugin (local)
 *
 * Lint rules that enforce the ZeusOS styling tech spec (docs/STYLING.md).
 * Rules ship at 'warn' initially (Phase U.1); will flip to 'error' in Phase
 * U.6 once the U.2 module-by-module token sweep and U.3 hex eradication
 * land.
 *
 * Surfaces:
 *   - Wired into eslint.config.js so the rules show up in `npm run lint`
 *     (buried in the broader 6k-problem noise, but present)
 *   - `npm run lint:design` (script in package.json) loads eslint.config.design.js
 *     which enables ONLY these rules — focused channel for design-system
 *     review.
 */

import noRawPalette from './no-raw-palette.js';
import noInlineStyleLiterals from './no-inline-style-literals.js';

export default {
  rules: {
    'no-raw-palette': noRawPalette,
    'no-inline-style-literals': noInlineStyleLiterals,
  },
};
