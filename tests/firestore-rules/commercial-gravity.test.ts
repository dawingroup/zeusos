/**
 * Firestore Security Rules — Commercial Gravity boundary tests.
 *
 * Verifies the spec §1.1 + §7.4 enforcement layers at the rules layer:
 *
 *   1. Subsidiary-org users cannot mutate `quotes`, `client_invoices`,
 *      `msas`, `sows`, `change_orders`.
 *   2. Subsidiary-org users cannot read `rate_card_lines` or `quote_lines`
 *      (which carry the internal `costMinor`).
 *   3. Subsidiary-org users cannot create / issue `internal_work_orders`
 *      (the IWO issue path is parent-only).
 *   4. PARENT-org users (Account Mgmt) can perform all of the above.
 *
 * Origin: cherry-picked from the standalone `phase-3a5-domain-remodel`
 * branch during Phase 3.D. The standalone branch targeted subcollection
 * paths (`organizations/{ORG}/quotes/...`); the live rules use root
 * collections (`quotes/{id}`), so paths were rewritten on import.
 *
 * Run with the Firestore emulator:
 *   firebase emulators:exec --only firestore "vitest run tests/firestore-rules"
 *
 * Prerequisites (NOT yet installed by Phase 3.D — fold into Phase 3.E):
 *   - `npm install --save-dev @firebase/rules-unit-testing`
 *   - Add a `test:rules` script that boots the Firestore emulator first.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

const ORG = 'default';
const PARENT_UID = 'am-jeffrey';
const SUBSIDIARY_UID = 'creative-andrew';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'zeusos-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed the staff registry — homeOrgId drives commercial-gravity helpers.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // AM user — parent org. Holds commercial scope.
    await setDoc(doc(db, 'organizations', ORG, 'users', PARENT_UID), {
      uid: PARENT_UID,
      email: 'jeffrey@zeustheagency.com',
      displayName: 'Jeffrey Amani',
      homeOrgId: 'zeus-group',
      globalRole: 'manager',
      isActive: true,
    });
    // Subsidiary delivery user — Zeus The Agency creative team.
    await setDoc(doc(db, 'organizations', ORG, 'users', SUBSIDIARY_UID), {
      uid: SUBSIDIARY_UID,
      email: 'andrew@zeustheagency.com',
      displayName: 'Andrew Radier',
      homeOrgId: 'zeus-the-agency',
      globalRole: 'member',
      isActive: true,
    });

    // A baseline SOW / Quote / Master Job / IWO so update + read tests
    // have something to operate against.
    await setDoc(doc(db, 'sows', 'sow-1'), {
      id: 'sow-1',
      msaId: 'msa-1',
      clientId: 'diageo',
      code: 'SOW-DIAGEO-2026-Q2',
      type: 'PROJECT',
      ceilingMinor: 50_000_000,
      currency: 'UGX',
      status: 'ACTIVE',
    });
    await setDoc(doc(db, 'quotes', 'q-1'), {
      id: 'q-1',
      sowId: 'sow-1',
      clientId: 'diageo',
      code: 'Q-DIAGEO-001',
      status: 'ISSUED',
      clientTotalMinor: 12_000_000,
      totalCostMinor: 8_000_000,
      currency: 'UGX',
      marginFloorPct: 25,
    });
    await setDoc(doc(db, 'quotes', 'q-1', 'quote_lines', 'ql-1'), {
      id: 'ql-1',
      quoteId: 'q-1',
      subsidiaryOrgId: 'zeus-the-agency',
      rateCardLineId: 'rcl-1',
      rateCardId: 'rc-1',
      roleCode: 'ART_DIRECTOR',
      unit: 'HOUR',
      description: 'Art direction',
      qty: 40,
      costMinor: 4_000_000,
      markupPct: 50,
      clientMinor: 6_000_000,
      currency: 'UGX',
    });
    await setDoc(doc(db, 'rate_cards', 'rc-1'), {
      id: 'rc-1',
      orgId: 'zeus-the-agency',
      version: 1,
      status: 'ACTIVE',
    });
    await setDoc(
      doc(db, 'rate_cards', 'rc-1', 'rate_card_lines', 'rcl-1'),
      {
        id: 'rcl-1',
        rateCardId: 'rc-1',
        unit: 'HOUR',
        roleCode: 'ART_DIRECTOR',
        costMinor: 100_000,
        currency: 'UGX',
      },
    );
    await setDoc(doc(db, 'master_jobs', 'mj-1'), {
      id: 'mj-1',
      sowId: 'sow-1',
      quoteId: 'q-1',
      clientId: 'diageo',
      code: 'ZTA-DIAGEO-2026-014',
      status: 'OPEN',
      allocatedMinor: 0,
      ceilingMinor: 50_000_000,
      clientTotalMinor: 12_000_000,
      currency: 'UGX',
    });
    await setDoc(doc(db, 'internal_work_orders', 'iwo-1'), {
      id: 'iwo-1',
      masterJobId: 'mj-1',
      subsidiaryOrgId: 'zeus-the-agency',
      code: 'IWO-ZTA-001',
      state: 'ISSUED',
      budgetMinor: 4_000_000,
      transferPriceMinor: 4_000_000,
      cumulativeCostMinor: 0,
      currency: 'UGX',
    });
    await setDoc(doc(db, 'msas', 'msa-1'), {
      id: 'msa-1',
      clientId: 'diageo',
      parentOrgId: 'zeus-group',
      code: 'MSA-DIAGEO-2026',
      title: 'Diageo Master Services Agreement',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
    });
    await setDoc(doc(db, 'client_invoices', 'ci-1'), {
      id: 'ci-1',
      clientId: 'diageo',
      masterJobId: 'mj-1',
      parentOrgId: 'zeus-group',
      invoiceNumber: 'INV-DIAGEO-2026-001',
      status: 'DRAFT',
      amountMinor: 12_000_000,
      currency: 'UGX',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Layer 1 — Subsidiary users cannot mutate commercial documents.
// ─────────────────────────────────────────────────────────────────────

describe('Commercial Gravity — subsidiary write denials', () => {
  test('subsidiary user CANNOT create a quote', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'quotes', 'q-new'), {
        id: 'q-new',
        sowId: 'sow-1',
        clientId: 'diageo',
        code: 'Q-NEW',
        status: 'DRAFT',
        clientTotalMinor: 1_000_000,
        totalCostMinor: 500_000,
        currency: 'UGX',
        marginFloorPct: 25,
      }),
    );
  });

  test('subsidiary user CANNOT update an existing quote', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'quotes', 'q-1'), { status: 'ACCEPTED' }),
    );
  });

  test('subsidiary user CANNOT create an MSA', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'msas', 'msa-new'), {
        id: 'msa-new',
        clientId: 'kcb',
        parentOrgId: 'zeus-group',
        code: 'MSA-KCB',
        title: 'KCB MSA',
        effectiveFrom: '2026-06-01',
        status: 'DRAFT',
      }),
    );
  });

  test('subsidiary user CANNOT update an SOW', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'sows', 'sow-1'), {
        ceilingMinor: 100_000_000,
      }),
    );
  });

  test('subsidiary user CANNOT create a change order', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'change_orders', 'co-new'), {
        id: 'co-new',
        sowId: 'sow-1',
        code: 'CO-001',
        deltaMinor: 5_000_000,
        currency: 'UGX',
        reason: 'Scope creep',
        status: 'DRAFT',
        createdBy: SUBSIDIARY_UID,
      }),
    );
  });

  test('subsidiary user CANNOT create a client invoice', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'client_invoices', 'ci-new'), {
        id: 'ci-new',
        clientId: 'diageo',
        masterJobId: 'mj-1',
        parentOrgId: 'zeus-group',
        invoiceNumber: 'INV-002',
        status: 'DRAFT',
        amountMinor: 1_000_000,
        currency: 'UGX',
      }),
    );
  });

  test('subsidiary user CANNOT update a client invoice', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'client_invoices', 'ci-1'), {
        status: 'ISSUED',
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Layer 2 — Subsidiary users cannot READ price/cost-internal collections.
// ─────────────────────────────────────────────────────────────────────

describe('Commercial Gravity — subsidiary read denials on cost-bearing collections', () => {
  test('subsidiary user CANNOT read a rate_card_line (costMinor exposure)', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      getDoc(doc(db, 'rate_cards', 'rc-1', 'rate_card_lines', 'rcl-1')),
    );
  });

  test('subsidiary user CANNOT read a rate_card', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(getDoc(doc(db, 'rate_cards', 'rc-1')));
  });

  test('subsidiary user CANNOT read a quote_line (costMinor exposure)', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      getDoc(doc(db, 'quotes', 'q-1', 'quote_lines', 'ql-1')),
    );
  });

  test('subsidiary user CANNOT read a quote (totalCostMinor exposure)', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(getDoc(doc(db, 'quotes', 'q-1')));
  });
});

// ─────────────────────────────────────────────────────────────────────
// Layer 3 — Subsidiary users cannot ISSUE Internal Work Orders.
// ─────────────────────────────────────────────────────────────────────

describe('Commercial Gravity — subsidiary cannot issue IWOs', () => {
  test('subsidiary user CANNOT create an IWO', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'internal_work_orders', 'iwo-new'), {
        id: 'iwo-new',
        masterJobId: 'mj-1',
        subsidiaryOrgId: 'zeus-the-agency',
        code: 'IWO-NEW',
        state: 'DRAFT',
        budgetMinor: 1_000_000,
        transferPriceMinor: 1_000_000,
        cumulativeCostMinor: 0,
        currency: 'UGX',
      }),
    );
  });

  test('subsidiary user CANNOT update an IWO (e.g. flip to ISSUED)', async () => {
    // Subsidiaries should never be authoring state transitions from the
    // client — Cloud Functions do that. Direct writes are blocked.
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'internal_work_orders', 'iwo-1'), {
        state: 'IN_PROGRESS',
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Parent-org (Account-Management) actors CAN do what subsidiaries can't.
// ─────────────────────────────────────────────────────────────────────

describe('Commercial Gravity — parent-org actor permitted operations', () => {
  test('AM user CAN create a quote', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'quotes', 'q-new'), {
        id: 'q-new',
        sowId: 'sow-1',
        clientId: 'diageo',
        code: 'Q-NEW',
        status: 'DRAFT',
        clientTotalMinor: 1_000_000,
        totalCostMinor: 500_000,
        currency: 'UGX',
        marginFloorPct: 25,
      }),
    );
  });

  test('AM user CAN read a rate_card_line', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, 'rate_cards', 'rc-1', 'rate_card_lines', 'rcl-1')),
    );
  });

  test('AM user CAN read a quote_line', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, 'quotes', 'q-1', 'quote_lines', 'ql-1')),
    );
  });

  test('AM user CAN update an SOW (raise ceiling)', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'sows', 'sow-1'), {
        ceilingMinor: 75_000_000,
      }),
    );
  });

  test('AM user CAN create an IWO', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'internal_work_orders', 'iwo-new'), {
        id: 'iwo-new',
        masterJobId: 'mj-1',
        subsidiaryOrgId: 'labyrinth',
        code: 'IWO-LAB-001',
        state: 'DRAFT',
        budgetMinor: 2_000_000,
        transferPriceMinor: 2_000_000,
        cumulativeCostMinor: 0,
        currency: 'UGX',
      }),
    );
  });

  test('AM user CAN create an MSA', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'msas', 'msa-new'), {
        id: 'msa-new',
        clientId: 'kcb',
        parentOrgId: 'zeus-group',
        code: 'MSA-KCB',
        title: 'KCB MSA',
        effectiveFrom: '2026-06-01',
        status: 'DRAFT',
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Domain-event outbox is read-everyone, write-system-only.
// ─────────────────────────────────────────────────────────────────────

describe('Domain events outbox is immutable from client SDK', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'domain_events', 'evt-1'), {
        id: 'evt-1',
        eventType: 'QuoteAccepted',
        ulid: 'evt-1',
        emittedAt: '2026-05-22T10:00:00Z',
        emittedByUserId: 'system',
        aggregateType: 'Quote',
        aggregateId: 'q-1',
        payload: { type: 'QuoteAccepted', data: { quoteId: 'q-1' } },
      });
    });
  });

  test('AM user CAN read domain events', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertSucceeds(getDoc(doc(db, 'domain_events', 'evt-1')));
  });

  test('subsidiary user CAN read domain events (transparency)', async () => {
    const db = testEnv.authenticatedContext(SUBSIDIARY_UID).firestore();
    await assertSucceeds(getDoc(doc(db, 'domain_events', 'evt-1')));
  });

  test('AM user CANNOT write a domain event directly (Cloud Function only)', async () => {
    const db = testEnv.authenticatedContext(PARENT_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'domain_events', 'evt-2'), {
        id: 'evt-2',
        eventType: 'IWOIssued',
        ulid: 'evt-2',
        emittedAt: '2026-05-22T10:00:00Z',
        emittedByUserId: PARENT_UID,
        aggregateType: 'IWO',
        aggregateId: 'iwo-1',
        payload: { type: 'IWOIssued', data: {} },
      }),
    );
  });
});
