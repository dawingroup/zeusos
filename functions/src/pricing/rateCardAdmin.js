/**
 * Rate-card admin callables — spec §4.3.
 *
 *   createRateCardVersion(orgId, lines[]) — versioned, UNIQUE(org_id, version), DRAFT
 *   activateRateCard(rateCardId, effectiveFrom) — DRAFT → ACTIVE; auto-retire prior
 *   retireRateCard(rateCardId) — ACTIVE → RETIRED
 *
 * All require PRICING_ADMIN on PARENT org (§7.4). Subsidiary principals
 * are rejected even before Firestore rules are consulted.
 *
 * PHASE 3.A.5 PLACEHOLDER: collection path is `rate_cards/{id}` (root).
 * 3.A.5's canonical path is `organizations/{subsidiary}/rate_cards/{id}`.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertPricingAdmin } = require('./lib/auth');
const {
  nextVersion,
  assertCanActivate,
  assertCanRetire,
  planActivation,
  RateCardError,
} = require('./lib/rateCardVersioning');

const VALID_SUBSIDIARIES = new Set([
  'zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus',
]);

// ─────────────────────────────────────────────────────────────────
// createRateCardVersion
// ─────────────────────────────────────────────────────────────────

exports.createRateCardVersion = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertPricingAdmin(request.auth);
    const { orgId, lines } = request.data || {};
    if (!VALID_SUBSIDIARIES.has(orgId)) {
      throw new HttpsError('invalid-argument', `orgId must be one of the 5 Zeus subsidiaries (got ${orgId}).`);
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new HttpsError('invalid-argument', 'lines[] must be non-empty.');
    }
    for (const [i, line] of lines.entries()) {
      if (!line.roleCode || !line.unit || typeof line.costMinor !== 'number' || !line.currency) {
        throw new HttpsError('invalid-argument', `Line ${i + 1}: roleCode, unit, costMinor, currency are required.`);
      }
      if (!['HOUR', 'DAY', 'UNIT', 'PASS_THROUGH'].includes(line.unit)) {
        throw new HttpsError('invalid-argument', `Line ${i + 1}: invalid unit ${line.unit}.`);
      }
      if (line.costMinor <= 0) {
        throw new HttpsError('invalid-argument', `Line ${i + 1}: costMinor must be > 0.`);
      }
    }

    const db = getFirestore();
    const existingSnap = await db.collection('rate_cards').where('orgId', '==', orgId).get();
    const existing = existingSnap.docs.map(d => ({ id: d.id, version: d.data().version || 1 }));
    const version = nextVersion(existing);

    const cardRef = db.collection('rate_cards').doc();
    const batch = db.batch();
    batch.set(cardRef, {
      orgId,
      version,
      status: 'DRAFT',
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const line of lines) {
      const lineRef = db.collection(`rate_cards/${cardRef.id}/rate_card_lines`).doc();
      batch.set(lineRef, {
        rateCardId: cardRef.id,
        roleCode: line.roleCode,
        unit: line.unit,
        costMinor: line.costMinor,
        currency: line.currency,
        description: line.description || null,
      });
    }
    await batch.commit();

    return { rateCardId: cardRef.id, version, lineCount: lines.length };
  },
);

// ─────────────────────────────────────────────────────────────────
// activateRateCard
// ─────────────────────────────────────────────────────────────────

exports.activateRateCard = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertPricingAdmin(request.auth);
    const { rateCardId, effectiveFrom } = request.data || {};
    if (!rateCardId) throw new HttpsError('invalid-argument', 'rateCardId is required.');
    if (!effectiveFrom) throw new HttpsError('invalid-argument', 'effectiveFrom is required (ISO date).');

    const fromDate = new Date(effectiveFrom);
    if (Number.isNaN(fromDate.getTime())) {
      throw new HttpsError('invalid-argument', 'effectiveFrom must be a valid ISO date.');
    }

    const db = getFirestore();
    const cardRef = db.doc(`rate_cards/${rateCardId}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(cardRef);
      if (!snap.exists) throw new HttpsError('not-found', `RateCard ${rateCardId} not found.`);
      const candidate = { id: snap.id, ...snap.data() };

      const priorSnap = await tx.get(
        db.collection('rate_cards').where('orgId', '==', candidate.orgId).where('status', '==', 'ACTIVE'),
      );
      const priorActive = priorSnap.docs[0]
        ? { id: priorSnap.docs[0].id, ...priorSnap.docs[0].data() }
        : null;

      let plan;
      try {
        plan = planActivation({
          candidate,
          currentActive: priorActive || undefined,
          effectiveFrom: fromDate,
        });
      } catch (err) {
        if (err instanceof RateCardError) throw new HttpsError('failed-precondition', err.message);
        throw err;
      }

      tx.update(cardRef, {
        status: 'ACTIVE',
        effectiveFrom: Timestamp.fromDate(plan.toActivate.effectiveFrom),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (plan.toRetire) {
        tx.update(db.doc(`rate_cards/${plan.toRetire.id}`), {
          status: 'RETIRED',
          effectiveTo: Timestamp.fromDate(plan.toRetire.effectiveTo),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Domain event — same outbox the quote lifecycle uses.
      await db.collection('domain_events').add({
        type: 'RateCardActivated',
        aggregateId: rateCardId,
        payload: {
          orgId: candidate.orgId,
          version: candidate.version,
          effectiveFrom: plan.toActivate.effectiveFrom.toISOString(),
          retiredPriorId: plan.toRetire ? plan.toRetire.id : null,
        },
        emittedBy: request.auth.uid,
        occurredAt: FieldValue.serverTimestamp(),
      });

      return {
        rateCardId,
        status: 'ACTIVE',
        retiredPriorId: plan.toRetire ? plan.toRetire.id : null,
      };
    });
  },
);

// ─────────────────────────────────────────────────────────────────
// retireRateCard (manual retire — used when no successor exists yet,
// e.g. discontinuing a subsidiary)
// ─────────────────────────────────────────────────────────────────

exports.retireRateCard = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertPricingAdmin(request.auth);
    const { rateCardId } = request.data || {};
    if (!rateCardId) throw new HttpsError('invalid-argument', 'rateCardId is required.');

    const db = getFirestore();
    const cardRef = db.doc(`rate_cards/${rateCardId}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(cardRef);
      if (!snap.exists) throw new HttpsError('not-found', `RateCard ${rateCardId} not found.`);
      const card = snap.data();
      try {
        assertCanRetire(card);
      } catch (err) {
        if (err instanceof RateCardError) throw new HttpsError('failed-precondition', err.message);
        throw err;
      }
      tx.update(cardRef, {
        status: 'RETIRED',
        effectiveTo: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection('domain_events').add({
        type: 'RateCardRetired',
        aggregateId: rateCardId,
        payload: { orgId: card.orgId, version: card.version },
        emittedBy: request.auth.uid,
        occurredAt: FieldValue.serverTimestamp(),
      });
      return { rateCardId, status: 'RETIRED' };
    });
  },
);
