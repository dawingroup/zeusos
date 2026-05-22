/**
 * Firestore-rules unit tests for the pricing collections — confirms the
 * §7.4 boundary's third layer (DB-side enforcement).
 *
 * PHASE 3.A.5 PRECONDITION: this suite requires the rules-unit-testing
 * harness + emulator. Until those are wired in 3.A.5, the suite is
 * `.skip`ped rather than failing red. The intended assertions are kept in
 * place so the reviewer can see exactly what 3.A.5 / 3.G unblock.
 */

import { describe, it } from 'vitest';

describe.skip('Firestore rules — pricing collections (requires emulator + 3.A.5)', () => {
  it('subsidiary user cannot read rate_card_lines (cost_minor field guard)', async () => {
    // Setup expectation (when wired):
    //   1. Initialise rules-test environment with firestore.rules
    //   2. Seed a user doc at users/{subsidiaryUid} with
    //      globalRole='member' and only subsidiary-scoped subsidiaryAccess
    //      (no zeus-group entry)
    //   3. Authed as that user, attempt to read
    //      `rate_cards/RC/rate_card_lines/L` — expect PERMISSION_DENIED.
  });

  it('parent-org admin CAN read rate_card_lines', async () => {
    // Authed as a user with globalRole='admin' and a zeus-group
    // subsidiaryAccess entry → read succeeds.
  });

  it('subsidiary user cannot read quote_lines (markup + cost guard)', async () => {
    // Same shape as above but against quotes/{Q}/quote_lines.
  });

  it('writes to rate_cards/quotes from the client are denied — must go via CFn', async () => {
    // Authed as a PRICING_ADMIN parent-org user, attempt to write
    // directly into rate_cards/{id} from the client SDK → denied.
    // Mutations are only allowed via the Admin SDK (CFns), which
    // bypasses these rules.
  });
});
