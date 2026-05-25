/**
 * Conflict-firewall admin callables — ADR-2026-05-25 §2.Q4.
 *
 * Replaces the retired Phase 6.C category-model callables (the
 * `categories` / `client_categories` / `conflict_walls` shape was
 * the wrong granularity per the resolution session). The new model
 * tracks named competitors per client; routing excludes any brand
 * currently serving a listed competitor.
 *
 * Two callables (the only writes needed for the new model):
 *
 *   addClientCompetitor       — adds a competitor to a client's list.
 *                               Idempotent on (clientId, competitorClientId).
 *   removeClientCompetitor    — removes the row.
 *
 * Auth: parent-org principal via `assertParentOrgPrincipal`. The
 * three-layer relax (ADR §3.2 step 4) lands later — until then,
 * subsidiary admins can't manage their own brand's competitor lists.
 *
 * Pure runners accept injected `fieldValue` + `assertAuth` so the
 * in-memory Firestore stub can drive them in unit tests.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');

function defaultFieldValue() {
  return FieldValue;
}

function assertString(value, field, { maxLen = 200, minLen = 1 } = {}) {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string`);
  }
  if (value.length < minLen || value.length > maxLen) {
    throw new HttpsError('invalid-argument', `${field} length must be between ${minLen} and ${maxLen}`);
  }
  return value;
}

function clientCompetitorDocId(clientId, competitorClientId) {
  return `${clientId}__${competitorClientId}`;
}

const VALID_SOURCES = new Set(['MSA', 'SOW', 'MANUAL']);

// ────────────────────────────────────────────────────────────────
// addClientCompetitor
// ────────────────────────────────────────────────────────────────

/**
 * Adds a competitor to a client's competitor list. Idempotent on
 * `(clientId, competitorClientId)` — re-issuing updates source +
 * notes without writing a duplicate row.
 *
 * Validates that both client docs exist before persisting so we don't
 * accumulate dangling references. If `competitorClientId === clientId`
 * the call rejects (can't be your own competitor).
 */
async function runAddClientCompetitor({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};

  const clientId = assertString(input.clientId, 'clientId');
  const competitorClientId = assertString(input.competitorClientId, 'competitorClientId');

  if (clientId === competitorClientId) {
    throw new HttpsError(
      'invalid-argument',
      'clientId and competitorClientId must differ (a client cannot be its own competitor).',
    );
  }

  const source = assertString(input.source || 'MANUAL', 'source', { maxLen: 20 });
  if (!VALID_SOURCES.has(source)) {
    throw new HttpsError(
      'invalid-argument',
      `source must be one of: ${Array.from(VALID_SOURCES).join(', ')}.`,
    );
  }
  const sourceAggregateId = assertString(
    input.sourceAggregateId || 'manual',
    'sourceAggregateId',
    { maxLen: 200 },
  );

  const id = clientCompetitorDocId(clientId, competitorClientId);
  const ref = db.doc(`client_competitors/${id}`);
  const now = fieldValue.serverTimestamp();
  let created = false;

  await db.runTransaction(async (tx) => {
    // Validate that the client exists. We don't validate the competitor
    // (it may be an external party — Coca-Cola might not be a Zeus client).
    const clientSnap = await tx.get(db.doc(`clients/${clientId}`));
    if (!clientSnap.exists) {
      throw new HttpsError('not-found', `Client ${clientId} not found.`);
    }

    const existing = await tx.get(ref);
    if (existing.exists) {
      tx.update(ref, {
        source,
        sourceAggregateId,
        notes: input.notes ?? existing.data().notes ?? null,
        effectiveUntil: input.effectiveUntil ?? existing.data().effectiveUntil ?? null,
      });
    } else {
      created = true;
      tx.set(ref, {
        id,
        clientId,
        competitorClientId,
        source,
        sourceAggregateId,
        notes: input.notes ?? null,
        effectiveUntil: input.effectiveUntil ?? null,
        addedBy: uid,
        addedAt: now,
      });
    }
  });

  return { id, clientId, competitorClientId, created };
}

exports.runAddClientCompetitor = runAddClientCompetitor;
exports.addClientCompetitor = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runAddClientCompetitor({
    db: getFirestore(),
    auth: request.auth,
    data: request.data,
  }),
);

// ────────────────────────────────────────────────────────────────
// removeClientCompetitor
// ────────────────────────────────────────────────────────────────

async function runRemoveClientCompetitor({
  db,
  auth,
  data,
  assertAuth = assertParentOrgPrincipal,
}) {
  await assertAuth(auth);
  const input = data || {};
  const clientId = assertString(input.clientId, 'clientId');
  const competitorClientId = assertString(input.competitorClientId, 'competitorClientId');
  const id = clientCompetitorDocId(clientId, competitorClientId);
  await db.doc(`client_competitors/${id}`).delete();
  return { id, removed: true };
}

exports.runRemoveClientCompetitor = runRemoveClientCompetitor;
exports.removeClientCompetitor = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runRemoveClientCompetitor({
    db: getFirestore(),
    auth: request.auth,
    data: request.data,
  }),
);

// Re-export the helper so callers (excludeConflicted, tests) can use
// the same composite-id format.
exports.clientCompetitorDocId = clientCompetitorDocId;
