/**
 * Shared bootstrap for Firestore-rules unit tests (Phase 3.G).
 *
 * Loads the production `firestore.rules` and pre-seeds the legal-entity
 * `organizations/{orgId}` docs that the rules' `isParentOrgPrincipal` /
 * `isSubsidiaryOrgPrincipal` helpers consult. Test files import
 * `bootstrap()` from here and get back a configured RulesTestEnvironment
 * plus a set of canonical UIDs so every spec speaks the same vocabulary.
 *
 * Seeds happen through `withSecurityRulesDisabled()` because the rules
 * themselves are the system under test — we don't want to be blocked from
 * setting up fixtures by the very rules we're trying to exercise.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RULES_PATH = resolve(process.cwd(), 'firestore.rules');

export const PARENT_ORG_ID = 'zeus-group';
export const SUBSIDIARY_ORG_ID = 'zeus-the-agency';
export const OTHER_SUBSIDIARY_ORG_ID = 'labyrinth';

export const PARENT_ADMIN_UID = 'parent-admin-uid';
export const SUBSIDIARY_USER_UID = 'subsidiary-user-uid';
export const OTHER_SUBSIDIARY_USER_UID = 'other-sub-user-uid';

export const RATE_CARD_ID = 'rc_zeus_the_agency_v1';
export const RATE_CARD_LINE_ID = 'rcl_sr_creative_director';
export const QUOTE_ID = 'q_msa_acme_001';
export const QUOTE_LINE_ID = 'ql_line_001';
export const MSA_ID = 'msa_acme_2026';
export const SOW_ID = 'sow_acme_brand_refresh';
export const CHANGE_ORDER_ID = 'co_acme_brand_refresh_01';
export const CLIENT_INVOICE_ID = 'ci_master_job_001';
export const IWO_SAME_SUB_ID = 'iwo_for_zeus_the_agency';
export const IWO_OTHER_SUB_ID = 'iwo_for_labyrinth';

let cachedEnv: RulesTestEnvironment | null = null;

export async function bootstrap(): Promise<RulesTestEnvironment> {
  if (cachedEnv) return cachedEnv;

  const rules = readFileSync(RULES_PATH, 'utf8');

  cachedEnv = await initializeTestEnvironment({
    projectId: `zeusos-rules-${Date.now()}`,
    firestore: {
      rules,
      host: 'localhost',
      port: 8080,
    },
  });

  return cachedEnv;
}

export async function teardown(): Promise<void> {
  if (cachedEnv) {
    await cachedEnv.cleanup();
    cachedEnv = null;
  }
}

/**
 * Seed the world the rules' helpers expect:
 *   - organizations/zeus-group       → kind=PARENT
 *   - organizations/zeus-the-agency  → kind=SUBSIDIARY
 *   - organizations/labyrinth        → kind=SUBSIDIARY (second sub for cross-tenant tests)
 *   - users/{parent-admin-uid}       → homeOrgId=zeus-group, globalRole=admin
 *   - users/{subsidiary-user-uid}    → homeOrgId=zeus-the-agency, globalRole=member
 *   - users/{other-sub-user-uid}     → homeOrgId=labyrinth, globalRole=member
 *
 * Plus a representative document at every commercial collection path
 * 3.G has to deny so each `resource.data` lookup the rule performs has
 * something real to evaluate against.
 */
export async function seedFixtures(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await db.doc(`organizations/${PARENT_ORG_ID}`).set({
      id: PARENT_ORG_ID,
      name: 'Zeus Group',
      kind: 'PARENT',
      is_legal_entity: true,
      base_currency: 'UGX',
    });

    await db.doc(`organizations/${SUBSIDIARY_ORG_ID}`).set({
      id: SUBSIDIARY_ORG_ID,
      name: 'Zeus The Agency',
      kind: 'SUBSIDIARY',
      is_legal_entity: true,
      base_currency: 'UGX',
    });

    await db.doc(`organizations/${OTHER_SUBSIDIARY_ORG_ID}`).set({
      id: OTHER_SUBSIDIARY_ORG_ID,
      name: 'Labyrinth Content Studio',
      kind: 'SUBSIDIARY',
      is_legal_entity: true,
      base_currency: 'UGX',
    });

    await db.doc(`users/${PARENT_ADMIN_UID}`).set({
      email: 'pricing-admin@zeusgroup.test',
      globalRole: 'admin',
      homeOrgId: PARENT_ORG_ID,
    });

    await db.doc(`users/${SUBSIDIARY_USER_UID}`).set({
      email: 'subsidiary-user@zeusgroup.test',
      globalRole: 'member',
      homeOrgId: SUBSIDIARY_ORG_ID,
    });

    await db.doc(`users/${OTHER_SUBSIDIARY_USER_UID}`).set({
      email: 'labyrinth-user@zeusgroup.test',
      globalRole: 'member',
      homeOrgId: OTHER_SUBSIDIARY_ORG_ID,
    });

    // ── Commercial-gravity fixtures ────────────────────────────────────
    await db.doc(`msas/${MSA_ID}`).set({
      client_id: 'client_acme',
      effective_date: '2026-01-01',
      ceiling_minor: 500_000_000,
      base_currency: 'UGX',
    });

    await db.doc(`sows/${SOW_ID}`).set({
      msa_id: MSA_ID,
      scope_doc_ref: 'docs/scope/acme_brand_refresh.md',
      ceiling_minor: 80_000_000,
      base_currency: 'UGX',
    });

    await db.doc(`change_orders/${CHANGE_ORDER_ID}`).set({
      sow_id: SOW_ID,
      delta_minor: 12_000_000,
      reason: 'Extra Stage 2 revisions.',
    });

    await db.doc(`client_invoices/${CLIENT_INVOICE_ID}`).set({
      master_job_id: 'master_job_001',
      total_minor: 80_000_000,
      status: 'ISSUED',
    });

    await db.doc(`rate_cards/${RATE_CARD_ID}`).set({
      org_id: SUBSIDIARY_ORG_ID,
      status: 'ACTIVE',
      effective_date: '2026-01-01',
    });

    await db.doc(`rate_cards/${RATE_CARD_ID}/rate_card_lines/${RATE_CARD_LINE_ID}`).set({
      role: 'Senior Creative Director',
      // cost_minor is what §4.5 invariant guards — must never reach a sub.
      cost_minor: 120_000,
      currency: 'UGX',
    });

    await db.doc(`quotes/${QUOTE_ID}`).set({
      sow_id: SOW_ID,
      status: 'DRAFT',
      total_client_minor: 80_000_000,
    });

    await db.doc(`quotes/${QUOTE_ID}/quote_lines/${QUOTE_LINE_ID}`).set({
      subsidiary_org_id: SUBSIDIARY_ORG_ID,
      role: 'Senior Creative Director',
      hours: 40,
      cost_minor: 4_800_000,
      markup_pct: 0.6,
      client_price_minor: 7_680_000,
    });

    // IWO owned by zeus-the-agency — the sub-user MAY read; labyrinth user MAY NOT.
    await db.doc(`internal_work_orders/${IWO_SAME_SUB_ID}`).set({
      master_job_id: 'master_job_001',
      subsidiaryOrgId: SUBSIDIARY_ORG_ID,
      status: 'ISSUED',
    });

    // IWO owned by labyrinth — the zeus-the-agency user MUST NOT read.
    await db.doc(`internal_work_orders/${IWO_OTHER_SUB_ID}`).set({
      master_job_id: 'master_job_002',
      subsidiaryOrgId: OTHER_SUBSIDIARY_ORG_ID,
      status: 'ISSUED',
    });
  });
}
