/**
 * Role-Profile + Role-Assignment admin callables — Phase 6.UI.A (PR 6).
 *
 * Replaces the "admin-only direct Firestore writes" path that
 * firestore.rules opens up (rules 3988 / 3993) with typed callables
 * so we get:
 *
 *   1. Consistent parent-org auth via `assertParentOrgPrincipal`.
 *   2. Idempotent upsert semantics on the role-profile and assignment
 *      collections (same `(employeeId, roleProfileId, effectiveFrom)`
 *      triple → same assignment id).
 *   3. Server-stamped audit fields (createdBy / createdAt /
 *      updatedBy / updatedAt / assignedBy / assignedAt).
 *
 * 5 callables:
 *   - createRoleProfile        upsert
 *   - updateRoleProfile        partial patch
 *   - archiveRoleProfile       status → 'archived'
 *   - assignEmployeeToRole     upsert role_assignment row
 *   - endRoleAssignment        set status='ended' + effectiveTo
 *
 * Pure runners accept injected `fieldValue` + `assertAuth` so the
 * in-memory Firestore stub drives them in unit tests.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');

function defaultFieldValue() {
  return FieldValue;
}

function assertString(v, field, { maxLen = 200, minLen = 1 } = {}) {
  if (typeof v !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string`);
  }
  if (v.length < minLen || v.length > maxLen) {
    throw new HttpsError('invalid-argument', `${field} length must be between ${minLen} and ${maxLen}`);
  }
  return v;
}

function profileSlugFromTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function defaultRoleProfileId(brandId, title) {
  return `ROLE-${brandId}-${profileSlugFromTitle(title)}`;
}

function assignmentDocId({ employeeId, roleProfileId, effectiveFrom }) {
  return `${employeeId}__${roleProfileId}__${effectiveFrom}`;
}

// ────────────────────────────────────────────────────────────────
// createRoleProfile
// ────────────────────────────────────────────────────────────────

async function runCreateRoleProfile({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};
  const brandId = assertString(input.brandId, 'brandId');
  const departmentId = assertString(input.departmentId, 'departmentId');
  const title = assertString(input.title, 'title');
  const jobLevel = assertString(input.jobLevel || 'mid', 'jobLevel', { maxLen: 40 });

  const id = input.id || defaultRoleProfileId(brandId, title);
  const ref = db.doc(`role_profile/${id}`);
  const now = fieldValue.serverTimestamp();
  let created = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const baseProfile = {
      id,
      brandId,
      departmentId,
      jobLevel,
      title,
      description: input.description ?? null,
      employmentTypes: input.employmentTypes ?? ['full_time'],
      reportsTo: input.reportsTo ?? [],
      supervises: input.supervises ?? [],
      peers: input.peers ?? [],
      escalationPath: input.escalationPath ?? [],
      delegationPool: input.delegationPool ?? [],
      skills: input.skills ?? [],
      taskCapabilities: input.taskCapabilities ?? [],
      approvalAuthorities: input.approvalAuthorities ?? [],
      typicalTaskLoad: input.typicalTaskLoad ?? { daily: 4, weekly: 20, maxConcurrent: 6 },
      aiContext: input.aiContext ?? {
        briefingPriorities: [],
        taskSortingWeights: {},
        communicationStyle: 'concise',
      },
      status: input.status ?? 'active',
    };
    if (snap.exists) {
      tx.update(ref, {
        ...baseProfile,
        updatedBy: uid,
        updatedAt: now,
      });
    } else {
      created = true;
      tx.set(ref, {
        ...baseProfile,
        createdBy: uid,
        createdAt: now,
        updatedBy: uid,
        updatedAt: now,
      });
    }
  });

  return { id, created };
}

exports.runCreateRoleProfile = runCreateRoleProfile;
exports.createRoleProfile = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runCreateRoleProfile({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// updateRoleProfile
// ────────────────────────────────────────────────────────────────

const UPDATABLE_FIELDS = new Set([
  'title', 'description', 'jobLevel', 'employmentTypes',
  'reportsTo', 'supervises', 'peers',
  'escalationPath', 'delegationPool',
  'skills', 'taskCapabilities', 'approvalAuthorities',
  'typicalTaskLoad', 'aiContext', 'status',
]);

async function runUpdateRoleProfile({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};
  const id = assertString(input.id, 'id');

  const patch = {};
  for (const k of Object.keys(input.patch || {})) {
    if (UPDATABLE_FIELDS.has(k)) patch[k] = input.patch[k];
  }
  if (Object.keys(patch).length === 0) {
    throw new HttpsError('invalid-argument', 'patch must include at least one updatable field');
  }

  const ref = db.doc(`role_profile/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', `RoleProfile ${id} not found`);
    }
    tx.update(ref, {
      ...patch,
      updatedBy: uid,
      updatedAt: fieldValue.serverTimestamp(),
    });
  });

  return { id, updated: true };
}

exports.runUpdateRoleProfile = runUpdateRoleProfile;
exports.updateRoleProfile = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runUpdateRoleProfile({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// archiveRoleProfile
// ────────────────────────────────────────────────────────────────

async function runArchiveRoleProfile({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const id = assertString((data || {}).id, 'id');
  const ref = db.doc(`role_profile/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', `RoleProfile ${id} not found`);
    }
    tx.update(ref, {
      status: 'archived',
      updatedBy: uid,
      updatedAt: fieldValue.serverTimestamp(),
    });
  });
  return { id, archived: true };
}

exports.runArchiveRoleProfile = runArchiveRoleProfile;
exports.archiveRoleProfile = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runArchiveRoleProfile({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// assignEmployeeToRole
// ────────────────────────────────────────────────────────────────

async function runAssignEmployeeToRole({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const input = data || {};
  const employeeId = assertString(input.employeeId, 'employeeId');
  const roleProfileId = assertString(input.roleProfileId, 'roleProfileId');
  const effectiveFrom = assertString(input.effectiveFrom, 'effectiveFrom', { maxLen: 40 });
  const id = assignmentDocId({ employeeId, roleProfileId, effectiveFrom });
  const ref = db.doc(`role_assignment/${id}`);
  const now = fieldValue.serverTimestamp();
  let created = false;

  await db.runTransaction(async (tx) => {
    const profileSnap = await tx.get(db.doc(`role_profile/${roleProfileId}`));
    if (!profileSnap.exists) {
      throw new HttpsError('not-found', `RoleProfile ${roleProfileId} not found`);
    }
    const existing = await tx.get(ref);
    const base = {
      id,
      employeeId,
      roleProfileId,
      effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      isPrimary: input.isPrimary !== false, // defaults true
      overrides: input.overrides ?? null,
      status: 'active',
    };
    if (existing.exists) {
      tx.update(ref, {
        ...base,
        assignedBy: uid,
        // preserve original assignedAt
      });
    } else {
      created = true;
      tx.set(ref, {
        ...base,
        assignedBy: uid,
        assignedAt: now,
      });
    }
  });

  return { id, employeeId, roleProfileId, created };
}

exports.runAssignEmployeeToRole = runAssignEmployeeToRole;
exports.assignEmployeeToRole = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runAssignEmployeeToRole({ db: getFirestore(), auth: request.auth, data: request.data }),
);

// ────────────────────────────────────────────────────────────────
// endRoleAssignment
// ────────────────────────────────────────────────────────────────

async function runEndRoleAssignment({
  db,
  auth,
  data,
  fieldValue = defaultFieldValue(),
  assertAuth = assertParentOrgPrincipal,
}) {
  await assertAuth(auth);
  const input = data || {};
  const id = assertString(input.id, 'id');
  const effectiveTo = assertString(input.effectiveTo || new Date().toISOString(), 'effectiveTo', { maxLen: 40 });
  const ref = db.doc(`role_assignment/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', `RoleAssignment ${id} not found`);
    }
    tx.update(ref, {
      status: 'ended',
      effectiveTo,
      endedAt: fieldValue.serverTimestamp(),
    });
  });
  return { id, ended: true };
}

exports.runEndRoleAssignment = runEndRoleAssignment;
exports.endRoleAssignment = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runEndRoleAssignment({ db: getFirestore(), auth: request.auth, data: request.data }),
);
