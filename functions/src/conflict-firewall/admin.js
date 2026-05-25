/**
 * Conflict-firewall admin callables — Phase 6.UI.C (PR 3).
 *
 * Thin write surface over the three collections (`categories`,
 * `client_categories`, `conflict_walls`) introduced by Phase 6.C.
 * `firestore.rules` already lets parent-org admin principals
 * read/write directly, but going through callables gives us:
 *
 *   1. A consistent auth signature (`assertParentOrgPrincipal`).
 *   2. Idempotency — repeating a request with the same composite
 *      key is a no-op rather than a duplicate write.
 *   3. Server-stamped audit fields (`createdBy`, `createdAt`).
 *   4. A central place to add domain events later if we want a
 *      `CategoryAdded` / `ClientCategoryAdded` audit trail.
 *
 * No new outbox event types are introduced — Phase 6.C's
 * `ConflictExclusivityRisk` is still the only firewall-related
 * event, fired by `routeBrand`'s `excludeConflicted` when a wall
 * actually blocks a routing decision.
 *
 * Each pure runner (`run*`) accepts an injectable `fieldValue` and
 * `assertAuth` so unit tests can drive them against the in-memory
 * Firestore stub without the real Firebase admin SDK loading.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');

function defaultFieldValue() {
  return FieldValue;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const CATEGORY_ID_PATTERN = /^[A-Z][A-Z0-9_]+$/;

function assertString(value, field, { maxLen = 200, minLen = 1 } = {}) {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string`);
  }
  if (value.length < minLen || value.length > maxLen) {
    throw new HttpsError(
      'invalid-argument',
      `${field} length must be between ${minLen} and ${maxLen}`,
    );
  }
  return value;
}

function clientCategoryDocId(clientId, categoryId) {
  return `${clientId}__${categoryId}`;
}

// ────────────────────────────────────────────────────────────────
// addCategory
// ────────────────────────────────────────────────────────────────

/**
 * Create or update a competitive category.
 *
 * Idempotent: re-issuing with the same id updates `name`,
 * `description`, `parentCategoryId`, `isActive` while preserving
 * the original `createdBy` / `createdAt`.
 */
async function runAddCategory({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};

  const id = assertString(input.id, 'id', { maxLen: 100 });
  if (!CATEGORY_ID_PATTERN.test(id)) {
    throw new HttpsError(
      'invalid-argument',
      'id must be UPPER_SNAKE_CASE (e.g. CARBONATED_BEVERAGE)',
    );
  }
  const name = assertString(input.name, 'name', { maxLen: 200 });

  const ref = db.doc(`categories/${id}`);
  const now = fieldValue.serverTimestamp();
  let created = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, {
        name,
        description: input.description ?? null,
        parentCategoryId: input.parentCategoryId ?? null,
        isActive: input.isActive ?? snap.data().isActive ?? true,
        updatedBy: uid,
        updatedAt: now,
      });
    } else {
      created = true;
      tx.set(ref, {
        id,
        name,
        description: input.description ?? null,
        parentCategoryId: input.parentCategoryId ?? null,
        isActive: input.isActive ?? true,
        createdBy: uid,
        createdAt: now,
        updatedBy: uid,
        updatedAt: now,
      });
    }
  });

  return { id, created };
}

exports.runAddCategory = runAddCategory;
exports.addCategory = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runAddCategory({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// addClientCategory
// ────────────────────────────────────────────────────────────────

/**
 * Tag a client with a category. Idempotent: re-issuing with the
 * same `(clientId, categoryId)` updates `exclusive` + `notes`
 * without writing a duplicate row.
 */
async function runAddClientCategory({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};

  const clientId = assertString(input.clientId, 'clientId');
  const categoryId = assertString(input.categoryId, 'categoryId');
  const exclusive = input.exclusive !== false; // defaults true

  const id = clientCategoryDocId(clientId, categoryId);
  const ref = db.doc(`client_categories/${id}`);
  const now = fieldValue.serverTimestamp();
  let created = false;

  await db.runTransaction(async (tx) => {
    const catSnap = await tx.get(db.doc(`categories/${categoryId}`));
    if (!catSnap.exists) {
      throw new HttpsError('not-found', `Unknown categoryId: ${categoryId}`);
    }
    const existing = await tx.get(ref);
    if (existing.exists) {
      tx.update(ref, {
        exclusive,
        notes: input.notes ?? existing.data().notes ?? null,
      });
    } else {
      created = true;
      tx.set(ref, {
        id,
        clientId,
        categoryId,
        exclusive,
        notes: input.notes ?? null,
        addedBy: uid,
        addedAt: now,
      });
    }
  });

  return { id, clientId, categoryId, exclusive, created };
}

exports.runAddClientCategory = runAddClientCategory;
exports.addClientCategory = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runAddClientCategory({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// removeClientCategory
// ────────────────────────────────────────────────────────────────

async function runRemoveClientCategory({
  db,
  auth,
  data,
  assertAuth = assertParentOrgPrincipal,
}) {
  await assertAuth(auth);
  const input = data || {};
  const clientId = assertString(input.clientId, 'clientId');
  const categoryId = assertString(input.categoryId, 'categoryId');
  const id = clientCategoryDocId(clientId, categoryId);
  await db.doc(`client_categories/${id}`).delete();
  return { id, removed: true };
}

exports.runRemoveClientCategory = runRemoveClientCategory;
exports.removeClientCategory = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runRemoveClientCategory({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// addConflictWall
// ────────────────────────────────────────────────────────────────

/**
 * Create a manual conflict wall. Auto-generated walls (the ones
 * created when `issueWorkOrder` is called for a categorised client)
 * land in 6.C.2 — for now this is the only write path that creates
 * a wall. `reason` defaults to `MANUAL_OVERRIDE` when not supplied.
 *
 * Idempotent across `(servingOrgId, categoryId, clientId)`: if a
 * wall already exists for that triple, the call is a no-op and
 * returns the existing wall id.
 */
async function runAddConflictWall({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};

  const clientId = assertString(input.clientId, 'clientId');
  const servingOrgId = assertString(input.servingOrgId, 'servingOrgId');
  const categoryId = assertString(input.categoryId, 'categoryId');
  const reason = assertString(input.reason || 'MANUAL_OVERRIDE', 'reason', { maxLen: 40 });
  const sourceAggregateType = assertString(
    input.sourceAggregateType || 'manual',
    'sourceAggregateType',
    { maxLen: 40 },
  );
  const sourceAggregateId = assertString(
    input.sourceAggregateId || 'manual',
    'sourceAggregateId',
    { maxLen: 200 },
  );

  // Idempotency lookup: existing wall for the (brand, category, client) triple.
  const existing = await db
    .collection('conflict_walls')
    .where('servingOrgId', '==', servingOrgId)
    .where('categoryId', '==', categoryId)
    .where('clientId', '==', clientId)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { id: existing.docs[0].id, created: false };
  }

  const ref = db.collection('conflict_walls').doc();
  const now = fieldValue.serverTimestamp();
  await ref.set({
    id: ref.id,
    clientId,
    servingOrgId,
    categoryId,
    reason,
    sourceAggregateType,
    sourceAggregateId,
    effectiveUntil: input.effectiveUntil ?? null,
    notes: input.notes ?? null,
    createdBy: uid,
    createdAt: now,
  });
  return { id: ref.id, created: true };
}

exports.runAddConflictWall = runAddConflictWall;
exports.addConflictWall = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runAddConflictWall({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// removeConflictWall
// ────────────────────────────────────────────────────────────────

async function runRemoveConflictWall({
  db,
  auth,
  data,
  assertAuth = assertParentOrgPrincipal,
}) {
  await assertAuth(auth);
  const input = data || {};
  const wallId = assertString(input.wallId, 'wallId');
  await db.doc(`conflict_walls/${wallId}`).delete();
  return { id: wallId, removed: true };
}

exports.runRemoveConflictWall = runRemoveConflictWall;
exports.removeConflictWall = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runRemoveConflictWall({ db: getFirestore(), auth: request.auth, data: request.data }),
);
