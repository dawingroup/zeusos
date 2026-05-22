/**
 * Phase 3.G — RBAC field-guard tests for commercial documents.
 *
 * Complements `commercial-boundary.test.ts` (which covers the headline
 * deny matrix) with the *document-shaped* field-leak surface called out
 * in the task prompt and Spec §7.4 / §12 "data segregation" NFR:
 *
 *   • `master_jobs/*`            — client_total_minor + ceiling_minor +
 *                                  margin live here. Subsidiary deny is
 *                                  document-level.
 *   • `budget_holds/*`           — allocation/hold amounts; AM-only.
 *   • `client_invoices/{id}/client_invoice_lines/*` — client billing
 *                                  totals; AM-only.
 *   • `intercompany_invoices/*`  — own-sub may read OWN outbound IC
 *                                  invoices; OTHER sub's must be denied
 *                                  (cross-tenant FX/cost leak).
 *   • Anonymous reads of master_jobs + internal_work_orders + budget_
 *     holds + intercompany_invoices must all fail (no client-portal
 *     surface for any of these).
 *
 * Firestore rules can ONLY allow/deny whole docs. Field-level redaction
 * within a doc the caller is allowed to read (e.g. hiding `budget_minor`
 * from the receiving subsidiary's IWO render) is enforced at the UI
 * layer and is tested separately by component tests; here we lock down
 * what the rules can guarantee.
 *
 * Run with: `npm run test:rules:emulated`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';

import {
  bootstrap,
  teardown,
  seedFixtures,
  IWO_OTHER_SUB_ID,
  IWO_SAME_SUB_ID,
  OTHER_SUBSIDIARY_ORG_ID,
  OTHER_SUBSIDIARY_USER_UID,
  PARENT_ADMIN_UID,
  SUBSIDIARY_ORG_ID,
  SUBSIDIARY_USER_UID,
} from './setup';

let env: RulesTestEnvironment;

const MASTER_JOB_ID = 'master_job_acme_001';
const BUDGET_HOLD_ID = 'hold_iwo_test_001';
const CLIENT_INVOICE_ID = 'ci_master_job_001';
const CLIENT_INVOICE_LINE_ID = 'cil_line_001';
const IC_FROM_SAME_SUB = 'ic_from_zeus_the_agency_001';
const IC_FROM_OTHER_SUB = 'ic_from_labyrinth_001';

beforeAll(async () => {
  env = await bootstrap();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedFixtures(env);

  // Extra fixtures unique to the field-guard tests.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // master_jobs — pricing rollup. Subsidiary MUST NOT read at all.
    await db.doc(`master_jobs/${MASTER_JOB_ID}`).set({
      id: MASTER_JOB_ID,
      sowId: 'sow_acme_brand_refresh',
      clientId: 'client_acme',
      status: 'OPEN',
      // Each of these is the kind of field §7.4 wants kept away from subs:
      allocatedMinor: 4_800_000,
      ceilingMinor: 80_000_000,
      clientTotalMinor: 80_000_000,
      currency: 'UGX',
    });

    // budget_holds — internal accounting only.
    await db.doc(`budget_holds/${BUDGET_HOLD_ID}`).set({
      iwoId: IWO_SAME_SUB_ID,
      masterJobId: MASTER_JOB_ID,
      heldMinor: 4_800_000,
      currency: 'UGX',
      status: 'ACTIVE',
    });

    // client_invoice_lines — child of client_invoices. Both AM-only.
    await db
      .doc(`client_invoices/${CLIENT_INVOICE_ID}/client_invoice_lines/${CLIENT_INVOICE_LINE_ID}`)
      .set({
        invoiceId: CLIENT_INVOICE_ID,
        description: 'Strategy hours — Stage 1',
        amountMinor: 7_680_000,
        currency: 'UGX',
      });

    // IC invoices — one outbound from zeus-the-agency (allowed for that
    // sub) + one outbound from labyrinth (must be denied to zeus-the-agency).
    await db.doc(`intercompany_invoices/${IC_FROM_SAME_SUB}`).set({
      iwoId: IWO_SAME_SUB_ID,
      masterJobId: MASTER_JOB_ID,
      fromOrgId: SUBSIDIARY_ORG_ID,
      toOrgId: 'zeus-group',
      amount: { amountMinor: 4_800_000, currency: 'UGX' },
      status: 'RAISED',
    });
    await db.doc(`intercompany_invoices/${IC_FROM_OTHER_SUB}`).set({
      iwoId: IWO_OTHER_SUB_ID,
      masterJobId: 'master_job_002',
      fromOrgId: OTHER_SUBSIDIARY_ORG_ID,
      toOrgId: 'zeus-group',
      amount: { amountMinor: 2_100_000, currency: 'UGX' },
      status: 'RAISED',
    });
  });
});

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

describe('Phase 3.G field-guards — master_jobs (subsidiary deny)', () => {
  it('subsidiary user CANNOT read master_jobs (client_total + ceiling + margin hidden)', async () => {
    await assertFails(getDoc(doc(subDb(), 'master_jobs', MASTER_JOB_ID)));
  });

  it('other subsidiary also CANNOT read (cross-tenant)', async () => {
    await assertFails(getDoc(doc(otherSubDb(), 'master_jobs', MASTER_JOB_ID)));
  });

  it('parent-org AM CAN read master_jobs', async () => {
    await assertSucceeds(getDoc(doc(parentDb(), 'master_jobs', MASTER_JOB_ID)));
  });

  it('anonymous CANNOT read master_jobs', async () => {
    await assertFails(getDoc(doc(anonDb(), 'master_jobs', MASTER_JOB_ID)));
  });
});

describe('Phase 3.G field-guards — budget_holds (AM only)', () => {
  it('subsidiary user CANNOT read their own IWO budget_hold', async () => {
    // Subsidiary sees their IWO doc (burn meter), but NOT the internal
    // hold accounting that backs it.
    await assertFails(getDoc(doc(subDb(), 'budget_holds', BUDGET_HOLD_ID)));
  });

  it('parent-org AM CAN read budget_holds', async () => {
    await assertSucceeds(
      getDoc(doc(parentDb(), 'budget_holds', BUDGET_HOLD_ID)),
    );
  });

  it('anonymous CANNOT read budget_holds', async () => {
    await assertFails(getDoc(doc(anonDb(), 'budget_holds', BUDGET_HOLD_ID)));
  });
});

describe('Phase 3.G field-guards — client_invoice_lines (AM only)', () => {
  it('subsidiary user CANNOT read client_invoice_lines (client billing leak)', async () => {
    await assertFails(
      getDoc(
        doc(
          subDb(),
          'client_invoices',
          CLIENT_INVOICE_ID,
          'client_invoice_lines',
          CLIENT_INVOICE_LINE_ID,
        ),
      ),
    );
  });

  it('parent-org AM CAN read client_invoice_lines', async () => {
    await assertSucceeds(
      getDoc(
        doc(
          parentDb(),
          'client_invoices',
          CLIENT_INVOICE_ID,
          'client_invoice_lines',
          CLIENT_INVOICE_LINE_ID,
        ),
      ),
    );
  });
});

describe('Phase 3.G field-guards — intercompany_invoices cross-tenant', () => {
  it('subsidiary CAN read its OWN outbound IC invoice', async () => {
    // zeus-the-agency reads its own outbound. Positive control.
    await assertSucceeds(
      getDoc(doc(subDb(), 'intercompany_invoices', IC_FROM_SAME_SUB)),
    );
  });

  it("subsidiary CANNOT read ANOTHER subsidiary's IC invoice", async () => {
    // zeus-the-agency must NOT see labyrinth's outbound IC invoice
    // (would leak labyrinth's billing amount + transfer price to a peer).
    await assertFails(
      getDoc(doc(subDb(), 'intercompany_invoices', IC_FROM_OTHER_SUB)),
    );
  });

  it('parent-org AM CAN read every IC invoice (consolidated AP view)', async () => {
    await assertSucceeds(
      getDoc(doc(parentDb(), 'intercompany_invoices', IC_FROM_SAME_SUB)),
    );
    await assertSucceeds(
      getDoc(doc(parentDb(), 'intercompany_invoices', IC_FROM_OTHER_SUB)),
    );
  });

  it('anonymous CANNOT read any intercompany_invoice', async () => {
    await assertFails(
      getDoc(doc(anonDb(), 'intercompany_invoices', IC_FROM_SAME_SUB)),
    );
  });
});

describe('Phase 3.G field-guards — anonymous baseline', () => {
  // The 25-test commercial-boundary suite covers anon-vs-quotes/msas/sows.
  // This block extends to the assignment / budget context the task prompt
  // calls out as having no client-portal surface.
  it('anonymous CANNOT read internal_work_orders', async () => {
    await assertFails(
      getDoc(doc(anonDb(), 'internal_work_orders', IWO_SAME_SUB_ID)),
    );
  });

  it('anonymous CANNOT read the IWO handoff_packet subdoc', async () => {
    await assertFails(
      getDoc(
        doc(
          anonDb(),
          'internal_work_orders',
          IWO_SAME_SUB_ID,
          'handoff_packet',
          'packet',
        ),
      ),
    );
  });
});
