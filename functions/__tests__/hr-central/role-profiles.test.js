/**
 * Role-profile + role-assignment callables — Phase 6.UI.A unit tests.
 *   cd functions && node --test __tests__/hr-central/role-profiles.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const {
  runCreateRoleProfile,
  runUpdateRoleProfile,
  runArchiveRoleProfile,
  runAssignEmployeeToRole,
  runEndRoleAssignment,
} = require('../../src/hr-central/role-profiles');

const SEED_AUTH = { uid: 'user-am-1' };
const stubAuth = (uid = 'user-am-1') => async () => ({ uid });

// ────────────────────────────────────────────────────────────────
// createRoleProfile
// ────────────────────────────────────────────────────────────────

test('createRoleProfile: assigns deterministic id from brand + title slug', async () => {
  const { db, FieldValue } = makeFirestore();
  const r = await runCreateRoleProfile({
    db, auth: SEED_AUTH,
    data: {
      brandId: 'zeus-the-agency',
      departmentId: 'creative',
      jobLevel: 'senior',
      title: 'Senior Designer',
    },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  assert.equal(r.id, 'ROLE-zeus-the-agency-senior-designer');
  assert.equal(r.created, true);
  const doc = db._dump()['role_profile/ROLE-zeus-the-agency-senior-designer'];
  assert.equal(doc.title, 'Senior Designer');
  assert.equal(doc.status, 'active');
  assert.equal(doc.createdBy, 'user-am-1');
});

test('createRoleProfile: idempotent — second call updates fields and returns created:false', async () => {
  const { db, FieldValue } = makeFirestore();
  await runCreateRoleProfile({
    db, auth: SEED_AUTH,
    data: { brandId: 'zeus-the-agency', departmentId: 'creative', jobLevel: 'senior', title: 'Senior Designer' },
    fieldValue: FieldValue, assertAuth: stubAuth('user-am-1'),
  });
  const r = await runCreateRoleProfile({
    db, auth: SEED_AUTH,
    data: { brandId: 'zeus-the-agency', departmentId: 'creative', jobLevel: 'senior', title: 'Senior Designer', description: 'updated' },
    fieldValue: FieldValue, assertAuth: stubAuth('user-am-2'),
  });
  assert.equal(r.created, false);
  const doc = db._dump()['role_profile/ROLE-zeus-the-agency-senior-designer'];
  assert.equal(doc.description, 'updated');
  assert.equal(doc.updatedBy, 'user-am-2');
  assert.equal(doc.createdBy, 'user-am-1', 'createdBy preserved across re-issue');
});

test('createRoleProfile: stores taskCapabilities verb matrix as data', async () => {
  const { db, FieldValue } = makeFirestore();
  await runCreateRoleProfile({
    db, auth: SEED_AUTH,
    data: {
      brandId: 'zeus-the-agency',
      departmentId: 'creative',
      jobLevel: 'senior',
      title: 'Senior Designer',
      taskCapabilities: [
        { eventType: 'creative.internal_approval_requested', taskTypes: ['review'],
          canInitiate: false, canExecute: true, canApprove: false, canDelegate: false },
      ],
    },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  const doc = db._dump()['role_profile/ROLE-zeus-the-agency-senior-designer'];
  assert.equal(doc.taskCapabilities.length, 1);
  assert.equal(doc.taskCapabilities[0].canExecute, true);
});

// ────────────────────────────────────────────────────────────────
// updateRoleProfile
// ────────────────────────────────────────────────────────────────

test('updateRoleProfile: whitelist filters unknown patch fields', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('role_profile/r1', {
    id: 'r1', brandId: 'zeus-the-agency', departmentId: 'creative',
    title: 'X', status: 'active', taskCapabilities: [],
  });
  await runUpdateRoleProfile({
    db, auth: SEED_AUTH,
    data: { id: 'r1', patch: { title: 'X2', evilField: 'pwned' } },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  const doc = db._dump()['role_profile/r1'];
  assert.equal(doc.title, 'X2');
  assert.equal(doc.evilField, undefined);
});

test('updateRoleProfile: rejects empty patch', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('role_profile/r1', { id: 'r1', title: 'X', status: 'active' });
  await assert.rejects(
    runUpdateRoleProfile({
      db, auth: SEED_AUTH, data: { id: 'r1', patch: {} },
      fieldValue: FieldValue, assertAuth: stubAuth(),
    }),
    /at least one updatable field/,
  );
});

// ────────────────────────────────────────────────────────────────
// archiveRoleProfile
// ────────────────────────────────────────────────────────────────

test('archiveRoleProfile: sets status=archived', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('role_profile/r1', { id: 'r1', title: 'X', status: 'active' });
  const r = await runArchiveRoleProfile({
    db, auth: SEED_AUTH, data: { id: 'r1' },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  assert.equal(r.archived, true);
  assert.equal(db._dump()['role_profile/r1'].status, 'archived');
});

// ────────────────────────────────────────────────────────────────
// assignEmployeeToRole
// ────────────────────────────────────────────────────────────────

test('assignEmployeeToRole: creates assignment row with composite id', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('role_profile/r1', { id: 'r1', title: 'X', status: 'active' });
  const r = await runAssignEmployeeToRole({
    db, auth: SEED_AUTH,
    data: { employeeId: 'emp-jane', roleProfileId: 'r1', effectiveFrom: '2026-05-25T00:00:00Z' },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  assert.equal(r.created, true);
  assert.equal(r.id, 'emp-jane__r1__2026-05-25T00:00:00Z');
  const doc = db._dump()['role_assignment/emp-jane__r1__2026-05-25T00:00:00Z'];
  assert.equal(doc.employeeId, 'emp-jane');
  assert.equal(doc.isPrimary, true);
  assert.equal(doc.status, 'active');
});

test('assignEmployeeToRole: rejects unknown roleProfileId', async () => {
  const { db, FieldValue } = makeFirestore();
  await assert.rejects(
    runAssignEmployeeToRole({
      db, auth: SEED_AUTH,
      data: { employeeId: 'emp-jane', roleProfileId: 'ghost', effectiveFrom: '2026-05-25T00:00:00Z' },
      fieldValue: FieldValue, assertAuth: stubAuth(),
    }),
    /not found/i,
  );
});

test('assignEmployeeToRole: idempotent on (employee, role, effectiveFrom) triple', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('role_profile/r1', { id: 'r1', title: 'X', status: 'active' });
  const r1 = await runAssignEmployeeToRole({
    db, auth: SEED_AUTH,
    data: { employeeId: 'emp-jane', roleProfileId: 'r1', effectiveFrom: '2026-05-25T00:00:00Z' },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  const r2 = await runAssignEmployeeToRole({
    db, auth: SEED_AUTH,
    data: { employeeId: 'emp-jane', roleProfileId: 'r1', effectiveFrom: '2026-05-25T00:00:00Z', isPrimary: false },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  assert.equal(r1.id, r2.id);
  assert.equal(r2.created, false);
  assert.equal(db._dump()['role_assignment/emp-jane__r1__2026-05-25T00:00:00Z'].isPrimary, false);
});

// ────────────────────────────────────────────────────────────────
// endRoleAssignment
// ────────────────────────────────────────────────────────────────

test('endRoleAssignment: sets status=ended and effectiveTo', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('role_assignment/a1', { id: 'a1', employeeId: 'emp-jane', roleProfileId: 'r1', status: 'active' });
  const r = await runEndRoleAssignment({
    db, auth: SEED_AUTH,
    data: { id: 'a1', effectiveTo: '2026-06-01T00:00:00Z' },
    fieldValue: FieldValue, assertAuth: stubAuth(),
  });
  assert.equal(r.ended, true);
  const doc = db._dump()['role_assignment/a1'];
  assert.equal(doc.status, 'ended');
  assert.equal(doc.effectiveTo, '2026-06-01T00:00:00Z');
});
