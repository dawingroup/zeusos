/**
 * approveTalentInvoice / approveMediaSupplierInvoice — the server-side door
 * for supplier spend (port stream F, routing v2 + ADR-2026-10-25).
 *
 * Before this, approving a freelancer or media-house invoice was a client
 * write (`writeBatch` from the talent panel) that recorded the literal
 * 'current-user' as the approver and checked nothing. Now:
 *
 *   1. The caller must be a parent-org principal AND a person (no machine or
 *      placeholder actor may approve — `policy.isMachineActor`).
 *   2. The invoice gets an approval PLAN on first touch: the routing-v2
 *      decision (purpose × amount × tier × aggregates → ordered signatures),
 *      frozen onto `approval` so later config edits do not rewrite it.
 *   3. Each call signs the LOWEST pending level the caller may sign: at
 *      least as senior as its role, or pinned to it (email / role-profile
 *      holder). The raiser never signs — admins and owners included — and
 *      nobody signs two levels.
 *   4. Only when every level is signed does `status` become APPROVED, with
 *      `approvedBy` = the final signer's uid, and (talent) the
 *      `TalentInvoiceApproved` outbox event the PO consumer listens for.
 *
 * The Firestore rules close the client door (`!isEnteringApproved()`), so
 * this is the only way an invoice reaches APPROVED.
 *
 * `runApproveSupplierInvoice` is dependency-injected (db, auth assert, config
 * loader, clock) so `__tests__/approvals/approveSupplierInvoice.test.js` can
 * drive it against the in-memory Firestore stub.
 */

'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { isMachineActor } = require('./policy');
const {
  loadApprovalRouting,
  moduleFor,
  routingDecisionFor,
  planFromDecision,
  planSignature,
} = require('./routing');

/** What differs between the two supplier-invoice collections. */
const TARGETS = {
  talent: {
    collection: 'talent_invoices',
    purpose: 'talent',
    endpoint: 'approveTalentInvoice',
    supplierField: 'talentProfileId',
    // The Phase 4.1 PO consumer (`onTalentInvoiceApproved`) listens for this.
    eventType: 'TalentInvoiceApproved',
    aggregateType: 'TalentInvoice',
    eventPayload: (invoiceId, inv) => ({
      talentInvoiceId: invoiceId,
      talentProfileId: inv.talentProfileId,
      masterJobId: inv.masterJobId,
      amountMinor: inv.amountMinor,
      currency: inv.currency,
      orgId: inv.orgId,
    }),
  },
  media: {
    collection: 'media_supplier_invoices',
    purpose: 'media',
    endpoint: 'approveMediaSupplierInvoice',
    supplierField: 'supplierOrgId',
    // Media's outbox event fires on PAID (`MediaSupplierInvoicePaid`), not on approval.
    eventType: null,
    aggregateType: 'MediaSupplierInvoice',
    eventPayload: null,
  },
};

const VERDICT_TO_CODE = {
  unauthenticated: 'unauthenticated',
  self_approval: 'permission-denied',
  already_signed: 'permission-denied',
  under_tier: 'permission-denied',
  already_complete: 'failed-precondition',
};

const APPROVED_STATUSES = ['APPROVED', 'PAID'];

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return null;
}

/**
 * The uids who currently hold a role profile: active `role_assignments`
 * for it → `employees/{employeeId}.userId`. Used when a signature pins a
 * role profile (e.g. "Zeus Group CFO") rather than a role tier.
 */
async function resolvePinnedUids({ db, roleProfileId }) {
  if (!roleProfileId) return [];
  const snap = await db
    .collection('role_assignments')
    .where('roleProfileId', '==', roleProfileId)
    .where('status', '==', 'active')
    .get();
  const uids = [];
  for (const d of snap.docs) {
    const employeeId = d.data().employeeId;
    if (!employeeId) continue;
    const emp = await db.doc(`employees/${employeeId}`).get();
    const uid = emp.exists && emp.data().userId;
    if (uid) uids.push(uid);
  }
  return uids;
}

/**
 * Precompute what the module's aggregate rules need. Only runs when rules
 * are configured (the default is none). `weekly_cash` is left unevaluated
 * here — it needs a date-range query across both collections and is wired
 * when a brand turns it on.
 */
async function computeAggregates({ db, module, target, inv, nowMs }) {
  const rules = (module && module.aggregateRules) || [];
  if (rules.length === 0) return {};
  const out = {};

  const rolling = rules.find((r) => r.kind === 'supplier_rolling');
  const supplierId = inv[target.supplierField];
  if (rolling && supplierId) {
    const since = nowMs - (rolling.windowDays || 30) * 86_400_000;
    const snap = await db.collection(target.collection).where(target.supplierField, '==', supplierId).get();
    out.supplierRollingMinor = snap.docs.reduce((sum, d) => {
      const row = d.data();
      if (!APPROVED_STATUSES.includes(row.status)) return sum;
      const at = toDate(row.approvedAt) || toDate(row.createdAt);
      if (!at || at.getTime() < since) return sum;
      return sum + (Number(row.amountMinor) || 0);
    }, 0);
  }

  const budget = rules.find((r) => r.kind === 'master_job_budget_pct');
  if (budget) {
    if (!inv.masterJobId) {
      out.masterJobBudgetPct = null; // unlinked spend: oversight sees it
    } else {
      // The engagement's spend ceiling (copied from SOW + accepted quote at open).
      const mj = await db.doc(`master_jobs/${inv.masterJobId}`).get();
      const budgetMinor = mj.exists ? Number(mj.data().ceilingMinor ?? mj.data().budgetMinor) : NaN;
      if (!Number.isFinite(budgetMinor) || budgetMinor <= 0) {
        out.masterJobBudgetPct = null; // unbudgeted engagement
      } else {
        const snap = await db.collection(target.collection).where('masterJobId', '==', inv.masterJobId).get();
        const spent = snap.docs.reduce((sum, d) => (APPROVED_STATUSES.includes(d.data().status) ? sum + (Number(d.data().amountMinor) || 0) : sum), 0);
        out.masterJobBudgetPct = ((spent + (Number(inv.amountMinor) || 0)) / budgetMinor) * 100;
      }
    }
  }
  return out;
}

/**
 * @param {object} args
 * @param {FirebaseFirestore.Firestore} args.db
 * @param {{ uid: string, token?: { email?: string } }} args.auth
 * @param {{ invoiceId: string, note?: string, idempotencyKey?: string }} args.data
 * @param {object} args.target  one of TARGETS
 * @param {object} [args.fieldValue]
 * @param {(auth) => Promise<{uid: string, user: object}>} [args.assertAuth]
 * @param {(opts) => Promise<object>} [args.loadConfig]
 * @param {() => string} [args.now]  ISO clock
 */
async function runApproveSupplierInvoice({
  db,
  auth,
  data,
  target,
  fieldValue = FieldValue,
  assertAuth = assertParentOrgPrincipal,
  loadConfig = loadApprovalRouting,
  now = () => new Date().toISOString(),
}) {
  if (!target) throw new HttpsError('internal', 'approval target not configured.');
  const { uid, user } = await assertAuth(auth);
  if (isMachineActor(uid)) {
    throw new HttpsError('permission-denied', 'An approval must name a person — a machine or placeholder actor cannot approve.');
  }
  const { invoiceId, note, idempotencyKey } = data || {};
  if (!invoiceId || typeof invoiceId !== 'string') throw new HttpsError('invalid-argument', 'invoiceId is required.');

  const nowIso = now();
  const config = await loadConfig({ db });
  const module = moduleFor(config);
  const ref = db.collection(target.collection).doc(invoiceId);

  // Plan inputs need queries (tier, aggregates, pinned holders), which a
  // transaction cannot run in every environment — read them first, then
  // re-read the invoice inside the transaction and verify its state.
  const pre = await ref.get();
  if (!pre.exists) throw new HttpsError('not-found', `Invoice ${invoiceId} not found.`);
  const inv0 = pre.data();

  let plan = inv0.approval && Array.isArray(inv0.approval.signatures) && inv0.approval.signatures.length > 0 ? inv0.approval : null;
  if (!plan) {
    let tier;
    if (inv0.masterJobId) {
      const mj = await db.doc(`master_jobs/${inv0.masterJobId}`).get();
      tier = mj.exists ? mj.data().tier : undefined;
    }
    const aggregates = await computeAggregates({ db, module, target, inv: inv0, nowMs: Date.parse(nowIso) });
    const decision = routingDecisionFor(
      {
        purpose: target.purpose,
        amountMinor: Number(inv0.amountMinor) || 0,
        currency: inv0.currency,
        tier,
        links: { masterJobId: inv0.masterJobId || null },
        aggregates,
      },
      config,
    );
    if (!decision.enabled || decision.refusal) {
      throw new HttpsError('failed-precondition', `This invoice cannot be routed for approval (${decision.refusal || 'routing disabled'}).`);
    }
    plan = planFromDecision(decision, nowIso);
  }

  const nextPending = plan.signatures.filter((s) => !s.approvedBy).sort((a, b) => a.level - b.level)[0];
  const pinnedUids = nextPending && nextPending.roleProfileId ? await resolvePinnedUids({ db, roleProfileId: nextPending.roleProfileId }) : [];
  const caller = {
    uid,
    role: user && user.globalRole,
    email: (auth && auth.token && auth.token.email) || (user && user.email) || null,
  };

  try {
    return await withIdempotency(db, { key: idempotencyKey, endpoint: target.endpoint }, async (tx, recordCache) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `Invoice ${invoiceId} not found.`);
      const inv = snap.data();

      if (inv.status === 'APPROVED' || inv.status === 'PAID') {
        const resp = { id: invoiceId, status: inv.status, complete: true, skip: 'already_approved' };
        recordCache(resp);
        return resp;
      }
      if (inv.status !== 'SUBMITTED') {
        throw new HttpsError('failed-precondition', `Invoice ${invoiceId} is ${inv.status}; only a SUBMITTED invoice can be approved.`);
      }

      const livePlan = inv.approval && Array.isArray(inv.approval.signatures) && inv.approval.signatures.length > 0 ? inv.approval : plan;
      const verdict = planSignature({ plan: livePlan, caller, raiserUid: inv.createdBy || null, pinnedUids });
      if (!verdict.ok) {
        throw new HttpsError(VERDICT_TO_CODE[verdict.code] || 'permission-denied', verdict.reason, { code: verdict.code, requiredRole: verdict.requiredRole || null, level: verdict.level || null });
      }

      // FieldValue sentinels are not allowed inside arrays — signature
      // timestamps are ISO strings; the doc-level approvedAt is a server stamp.
      const signatures = livePlan.signatures.map((s) =>
        s.level === verdict.level
          ? { ...s, approvedBy: uid, approvedByName: (user && (user.displayName || user.name)) || null, approvedAt: nowIso, via: verdict.via, note: note ? String(note).slice(0, 1000) : null }
          : s,
      );
      const approval = {
        ...livePlan,
        signatures,
        pendingLevel: verdict.complete ? null : verdict.level + 1,
        ...(verdict.complete ? { completedAt: nowIso } : {}),
      };

      if (verdict.complete) {
        tx.update(ref, {
          status: 'APPROVED',
          approvedBy: uid,
          approvedAt: fieldValue.serverTimestamp(),
          approval,
          updatedAt: fieldValue.serverTimestamp(),
        });
        if (target.eventType) {
          appendDomainEvent({
            tx,
            db,
            eventType: target.eventType,
            aggregateType: target.aggregateType,
            aggregateId: invoiceId,
            payload: target.eventPayload(invoiceId, inv),
            emittedByUserId: uid,
            idempotencyKey,
          });
        }
      } else {
        tx.update(ref, { approval, updatedAt: fieldValue.serverTimestamp() });
      }

      const resp = {
        id: invoiceId,
        status: verdict.complete ? 'APPROVED' : 'SUBMITTED',
        level: verdict.level,
        complete: verdict.complete,
        pendingLevel: approval.pendingLevel,
        bandId: approval.bandId,
        signaturesRequired: signatures.length,
      };
      recordCache(resp);
      return resp;
    });
  } catch (err) {
    throw toHttpsError(err);
  }
}

const callableOpts = { cors: ALLOWED_ORIGINS, region: 'europe-west1' };

exports.TARGETS = TARGETS;
exports.runApproveSupplierInvoice = runApproveSupplierInvoice;
exports.resolvePinnedUids = resolvePinnedUids;
exports.computeAggregates = computeAggregates;

exports.approveTalentInvoice = onCall(callableOpts, (request) =>
  runApproveSupplierInvoice({ db: getFirestore(), auth: request.auth, data: request.data, target: TARGETS.talent }),
);
exports.approveMediaSupplierInvoice = onCall(callableOpts, (request) =>
  runApproveSupplierInvoice({ db: getFirestore(), auth: request.auth, data: request.data, target: TARGETS.media }),
);
