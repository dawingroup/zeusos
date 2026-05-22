/**
 * Phase 3.G — Boundary enforcement tests for commercial collections.
 *
 * Verifies layer-1 (Firestore rules) of the three-layer enforcement
 * described in Tech Spec v1.0 §7.4:
 *
 *   • Subsidiary principals MUST be denied READS on every commercial-
 *     gravity collection (rate_card_lines.cost_minor, quote_lines,
 *     msas, sows, change_orders, client_invoices, master_jobs,
 *     other-subsidiaries' IWOs).
 *
 *   • Subsidiary principals MUST be denied WRITES on the same set
 *     (mutations only flow through Cloud Functions / Admin SDK).
 *
 *   • Parent-org PRICING_ADMIN principals MUST be allowed READS so the
 *     deny rule isn't catastrophically over-broad (positive control).
 *
 *   • Unauthenticated callers MUST be denied unless the existing
 *     client-portal whitelist applies.
 *
 * Run against the Firestore emulator: `npm run test:rules:emulated`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

import {
  bootstrap,
  teardown,
  seedFixtures,
  CHANGE_ORDER_ID,
  CLIENT_INVOICE_ID,
  IWO_OTHER_SUB_ID,
  IWO_SAME_SUB_ID,
  MSA_ID,
  OTHER_SUBSIDIARY_USER_UID,
  PARENT_ADMIN_UID,
  QUOTE_ID,
  QUOTE_LINE_ID,
  RATE_CARD_ID,
  RATE_CARD_LINE_ID,
  SOW_ID,
  SUBSIDIARY_USER_UID,
} from './setup';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await bootstrap();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedFixtures(env);
});

// All staff sign in via Firebase Auth (email+password / Google), so the
// caller's token always carries `email`. The rules' `isSuperUser` helper
// dereferences `request.auth.token.email` directly — without it, rules
// throw "Property email is undefined" rather than evaluating to false.
const subDb = () =>
  env.authenticatedContext(SUBSIDIARY_USER_UID, {
    email: 'subsidiary-user@zeusgroup.test',
  }).firestore();
const otherSubDb = () =>
  env.authenticatedContext(OTHER_SUBSIDIARY_USER_UID, {
    email: 'labyrinth-user@zeusgroup.test',
  }).firestore();
const parentDb = () =>
  env.authenticatedContext(PARENT_ADMIN_UID, {
    email: 'pricing-admin@zeusgroup.test',
  }).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();

describe('Phase 3.G — subsidiary principals: denied reads', () => {
  it('denies reading rate_card_lines (cost_minor exposure)', async () => {
    await assertFails(
      getDoc(
        doc(
          subDb(),
          'rate_cards',
          RATE_CARD_ID,
          'rate_card_lines',
          RATE_CARD_LINE_ID,
        ),
      ),
    );
  });

  it('denies reading the parent rate_card doc itself', async () => {
    await assertFails(getDoc(doc(subDb(), 'rate_cards', RATE_CARD_ID)));
  });

  it('denies reading quote_lines (cost_minor + markup_pct exposure)', async () => {
    await assertFails(
      getDoc(
        doc(
          subDb(),
          'quotes',
          QUOTE_ID,
          'quote_lines',
          QUOTE_LINE_ID,
        ),
      ),
    );
  });

  it('denies reading the parent quote doc itself', async () => {
    await assertFails(getDoc(doc(subDb(), 'quotes', QUOTE_ID)));
  });

  it('denies reading an msa (umbrella commercial terms)', async () => {
    await assertFails(getDoc(doc(subDb(), 'msas', MSA_ID)));
  });

  it('denies reading a sow (scope_doc_ref + ceiling)', async () => {
    await assertFails(getDoc(doc(subDb(), 'sows', SOW_ID)));
  });

  it('denies reading a change_order', async () => {
    await assertFails(
      getDoc(doc(subDb(), 'change_orders', CHANGE_ORDER_ID)),
    );
  });

  it('denies reading a client_invoice', async () => {
    await assertFails(
      getDoc(doc(subDb(), 'client_invoices', CLIENT_INVOICE_ID)),
    );
  });

  it("denies reading another subsidiary's internal_work_order", async () => {
    // labyrinth user trying to read a zeus-the-agency IWO.
    await assertFails(
      getDoc(
        doc(otherSubDb(), 'internal_work_orders', IWO_SAME_SUB_ID),
      ),
    );
  });

  it("allows reading the caller's OWN internal_work_order", async () => {
    // Positive: zeus-the-agency user reading their own IWO succeeds —
    // proves the deny rule isn't blanket-deny.
    await assertSucceeds(
      getDoc(doc(subDb(), 'internal_work_orders', IWO_SAME_SUB_ID)),
    );
  });
});

describe('Phase 3.G — subsidiary principals: denied writes', () => {
  it('denies mutating a quote', async () => {
    await assertFails(
      setDoc(
        doc(subDb(), 'quotes', QUOTE_ID),
        { status: 'ISSUED' },
        { merge: true },
      ),
    );
  });

  it('denies mutating a client_invoice', async () => {
    await assertFails(
      setDoc(
        doc(subDb(), 'client_invoices', CLIENT_INVOICE_ID),
        { status: 'PAID' },
        { merge: true },
      ),
    );
  });

  it('denies mutating an msa', async () => {
    await assertFails(
      setDoc(
        doc(subDb(), 'msas', MSA_ID),
        { ceiling_minor: 999_999_999 },
        { merge: true },
      ),
    );
  });

  it('denies mutating a sow', async () => {
    await assertFails(
      setDoc(
        doc(subDb(), 'sows', SOW_ID),
        { ceiling_minor: 999_999_999 },
        { merge: true },
      ),
    );
  });

  it('denies mutating a change_order', async () => {
    await assertFails(
      setDoc(
        doc(subDb(), 'change_orders', CHANGE_ORDER_ID),
        { delta_minor: 1 },
        { merge: true },
      ),
    );
  });

  it('denies deleting commercial docs (defense in depth)', async () => {
    await assertFails(deleteDoc(doc(subDb(), 'quotes', QUOTE_ID)));
    await assertFails(deleteDoc(doc(subDb(), 'msas', MSA_ID)));
    await assertFails(deleteDoc(doc(subDb(), 'sows', SOW_ID)));
  });

  it("denies issuing an IWO on behalf of another subsidiary", async () => {
    // Even if a sub user invents an IWO id, they must not be able to
    // write a doc whose subsidiaryOrgId points at a different sub.
    await assertFails(
      setDoc(doc(subDb(), 'internal_work_orders', 'iwo_forged'), {
        master_job_id: 'master_job_xyz',
        subsidiaryOrgId: IWO_OTHER_SUB_ID, // <- pointing at a different sub
        status: 'ISSUED',
      }),
    );
  });

  it('denies mutating their OWN internal_work_order from the client SDK', async () => {
    // Even own-sub IWO mutations must go through the issueWorkOrder /
    // acceptWorkOrder CFns (Admin SDK bypasses these rules).
    await assertFails(
      setDoc(
        doc(subDb(), 'internal_work_orders', IWO_SAME_SUB_ID),
        { status: 'ACCEPTED' },
        { merge: true },
      ),
    );
  });
});

describe('Phase 3.G — parent-org PRICING_ADMIN: allowed reads', () => {
  it('reads rate_card_lines.cost_minor', async () => {
    await assertSucceeds(
      getDoc(
        doc(
          parentDb(),
          'rate_cards',
          RATE_CARD_ID,
          'rate_card_lines',
          RATE_CARD_LINE_ID,
        ),
      ),
    );
  });

  it('reads quote_lines (cost_minor + markup_pct)', async () => {
    await assertSucceeds(
      getDoc(
        doc(
          parentDb(),
          'quotes',
          QUOTE_ID,
          'quote_lines',
          QUOTE_LINE_ID,
        ),
      ),
    );
  });

  it('reads msas, sows, change_orders, client_invoices', async () => {
    await assertSucceeds(getDoc(doc(parentDb(), 'msas', MSA_ID)));
    await assertSucceeds(getDoc(doc(parentDb(), 'sows', SOW_ID)));
    await assertSucceeds(
      getDoc(doc(parentDb(), 'change_orders', CHANGE_ORDER_ID)),
    );
    await assertSucceeds(
      getDoc(doc(parentDb(), 'client_invoices', CLIENT_INVOICE_ID)),
    );
  });

  it("reads every subsidiary's internal_work_orders (rollup view)", async () => {
    await assertSucceeds(
      getDoc(doc(parentDb(), 'internal_work_orders', IWO_SAME_SUB_ID)),
    );
    await assertSucceeds(
      getDoc(doc(parentDb(), 'internal_work_orders', IWO_OTHER_SUB_ID)),
    );
  });

  it('still cannot write commercial docs directly (CFn-only mutations)', async () => {
    // Even the parent-org admin uses CFns for mutations — the rules
    // deny ALL client-SDK writes on these collections by design.
    await assertFails(
      setDoc(
        doc(parentDb(), 'quotes', QUOTE_ID),
        { status: 'ISSUED' },
        { merge: true },
      ),
    );
  });
});

describe('Phase 3.G — unauthenticated callers', () => {
  it('cannot read commercial docs', async () => {
    await assertFails(getDoc(doc(anonDb(), 'quotes', QUOTE_ID)));
    await assertFails(getDoc(doc(anonDb(), 'msas', MSA_ID)));
    await assertFails(getDoc(doc(anonDb(), 'sows', SOW_ID)));
    await assertFails(
      getDoc(doc(anonDb(), 'client_invoices', CLIENT_INVOICE_ID)),
    );
    await assertFails(
      getDoc(doc(anonDb(), 'rate_cards', RATE_CARD_ID, 'rate_card_lines', RATE_CARD_LINE_ID)),
    );
  });

  it('cannot write commercial docs', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'quotes', 'q_anon_forge'), { status: 'DRAFT' }),
    );
    await assertFails(
      setDoc(doc(anonDb(), 'internal_work_orders', 'iwo_anon_forge'), {
        subsidiaryOrgId: 'zeus-the-agency',
      }),
    );
  });
});
