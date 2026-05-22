/**
 * Firestore-rules unit tests — pricing collections.
 *
 * The canonical pricing-rules assertions were moved to
 * `src/testing/rules/commercial-boundary.test.ts` (Phase 3.G) so they
 * sit alongside every other commercial-gravity rule assertion
 * (msas, sows, change_orders, client_invoices, internal_work_orders)
 * and share one bootstrap path.
 *
 * Run with:
 *   npm run test:rules:emulated
 *
 * (or `npm run test:rules` if the Firestore emulator is already running
 * on localhost:8080.)
 */

import { describe, it } from 'vitest';

describe('Pricing rules — moved', () => {
  it('see src/testing/rules/commercial-boundary.test.ts', () => {
    // No-op placeholder — kept so the old import path doesn't 404 in
    // anyone's editor recents. The real assertions live in 3.G's
    // boundary suite (rate_cards, rate_card_lines, quotes, quote_lines).
  });
});
