/**
 * EmployeeAssignmentService.resolveAssignment — Phase 6.A.1 unit tests.
 *   cd functions && node --test __tests__/assignment/employee-assignment.test.js
 *
 * Covers the `role` rule type only — the other 5 throw `unimplemented`
 * by design (land in Phase 6.A.2). The dispatcher itself is exercised
 * via invalid-rule cases.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('./_firestore-stub');
const {
  resolveAssignment,
  _internals,
} = require('../../src/assignment/services/employee-assignment.service');

// ----- helpers --------------------------------------------------------

async function seedRoleProfile(db, overrides = {}) {
  const id = overrides.id || 'ROLE-zeus-the-agency-art-director';
  await db.doc(`role_profile/${id}`).set({
    id,
    brandId: overrides.brandId ?? 'zeus-the-agency',
    departmentId: overrides.departmentId ?? 'dept_creative',
    jobLevel: overrides.jobLevel ?? 'senior',
    employmentTypes: overrides.employmentTypes ?? ['permanent'],
    title: overrides.title ?? 'Art Director',
    reportsTo: [],
    supervises: [],
    peers: [],
    escalationPath: [],
    delegationPool: [],
    skills: [],
    taskCapabilities: [],
    approvalAuthorities: [],
    typicalTaskLoad: overrides.typicalTaskLoad ?? { daily: 4, weekly: 20, maxConcurrent: 3 },
    aiContext: { briefingPriorities: [], taskSortingWeights: {}, communicationStyle: 'concise' },
    status: 'active',
    createdBy: 'seed',
    createdAt: new Date('2026-01-01').toISOString(),
    updatedBy: 'seed',
    updatedAt: new Date('2026-01-01').toISOString(),
  });
  return id;
}

async function seedRoleAssignment(db, overrides = {}) {
  const id = overrides.id || `RA-${Math.random().toString(36).slice(2, 9)}`;
  await db.doc(`role_assignment/${id}`).set({
    id,
    employeeId: overrides.employeeId,
    roleProfileId: overrides.roleProfileId,
    effectiveFrom: overrides.effectiveFrom ?? new Date('2026-01-01').toISOString(),
    effectiveTo: overrides.effectiveTo,
    isPrimary: overrides.isPrimary ?? true,
    overrides: overrides.overrides,
    assignedBy: 'seed',
    assignedAt: new Date('2026-01-01').toISOString(),
    status: overrides.status ?? 'active',
  });
  return id;
}

// ----- dispatcher -----------------------------------------------------

test('rejects invalid rule.type', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => resolveAssignment({
      db,
      rule: { type: 'gibberish' },
      context: { eventType: 'creative.internal_approval_requested' },
    }),
    /rule\.type must be one of/
  );
});

test('rejects missing context.eventType', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => resolveAssignment({
      db,
      rule: { type: 'role', roleProfileId: 'r1' },
      context: {},
    }),
    /eventType is required/
  );
});

test('rule types other than role throw unimplemented (Phase 6.A.2)', async () => {
  const { db } = makeFirestore();
  for (const t of ['department', 'user', 'manager', 'creator', 'dynamic']) {
    await assert.rejects(
      () => resolveAssignment({
        db,
        rule: { type: t },
        context: { eventType: 'iwo.sla_due_soon' },
      }),
      /Phase 6\.A\.2/
    );
  }
});

// ----- role rule: not-found / scope -----------------------------------

test('role rule: missing RoleProfile → not-found', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => resolveAssignment({
      db,
      rule: { type: 'role', roleProfileId: 'ROLE-does-not-exist' },
      context: { eventType: 'creative.internal_approval_requested' },
    }),
    /RoleProfile 'ROLE-does-not-exist'/
  );
});

test('role rule: brand-scope mismatch → no winner + audit-trail snapshot', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db, { brandId: 'zeus-the-agency' });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested', brandId: 'odd-gorilla' },
  });

  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.rejected, 'brand-scope-mismatch');
  assert.equal(r.rankSnapshot.roleProfileBrandId, 'zeus-the-agency');
  assert.equal(r.rankSnapshot.contextBrandId, 'odd-gorilla');
});

test('role rule: brandId=all bypasses scope check', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db, {
    id: 'ROLE-all-traffic-manager',
    brandId: 'all',
  });
  await seedRoleAssignment(db, {
    employeeId: 'EMP-zeus-group-0001',
    roleProfileId: roleId,
    isPrimary: true,
  });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'iwo.sla_due_soon', brandId: 'zeus-digital' },
  });

  assert.equal(r.assignedEmployeeId, 'EMP-zeus-group-0001');
});

// ----- role rule: candidate selection ---------------------------------

test('role rule: no active assignments → no winner', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested' },
  });

  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'no-active-assignments');
});

test('role rule: single active primary wins', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);
  await seedRoleAssignment(db, {
    employeeId: 'EMP-zeus-the-agency-0042',
    roleProfileId: roleId,
    isPrimary: true,
  });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested' },
  });

  assert.equal(r.assignedEmployeeId, 'EMP-zeus-the-agency-0042');
  assert.equal(r.ruleTypeUsed, 'role');
  assert.equal(r.rankSnapshot.candidates.length, 1);
  assert.equal(r.rankSnapshot.candidates[0].isPrimary, true);
});

test('role rule: primary tie-breaks above secondary at same load', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);
  await seedRoleAssignment(db, {
    employeeId: 'EMP-secondary',
    roleProfileId: roleId,
    isPrimary: false,
  });
  await seedRoleAssignment(db, {
    employeeId: 'EMP-primary',
    roleProfileId: roleId,
    isPrimary: true,
  });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested' },
  });

  assert.equal(r.assignedEmployeeId, 'EMP-primary');
});

test('role rule: paused assignment (overrides.pausedUntil in future) excluded', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);
  await seedRoleAssignment(db, {
    employeeId: 'EMP-paused',
    roleProfileId: roleId,
    isPrimary: true,
    overrides: { pausedUntil: new Date('2099-12-31').toISOString() },
  });
  await seedRoleAssignment(db, {
    employeeId: 'EMP-active',
    roleProfileId: roleId,
    isPrimary: false,
  });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested' },
  });

  assert.equal(r.assignedEmployeeId, 'EMP-active');
});

test('role rule: expired effectiveTo excludes the assignment', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);
  await seedRoleAssignment(db, {
    employeeId: 'EMP-expired',
    roleProfileId: roleId,
    isPrimary: true,
    effectiveFrom: new Date('2020-01-01').toISOString(),
    effectiveTo: new Date('2025-12-31').toISOString(),
  });
  await seedRoleAssignment(db, {
    employeeId: 'EMP-still-active',
    roleProfileId: roleId,
    isPrimary: false,
    effectiveFrom: new Date('2026-01-01').toISOString(),
  });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested' },
    now: new Date('2026-05-24'),
  });

  assert.equal(r.assignedEmployeeId, 'EMP-still-active');
});

test('role rule: status=ended excluded', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);
  await seedRoleAssignment(db, {
    employeeId: 'EMP-ended',
    roleProfileId: roleId,
    isPrimary: true,
    status: 'ended',
  });

  const r = await resolveAssignment({
    db,
    rule: { type: 'role', roleProfileId: roleId },
    context: { eventType: 'creative.internal_approval_requested' },
  });

  assert.equal(r.assignedEmployeeId, null);
});

// ----- fallback chain -------------------------------------------------

test('fallback chain triggers when primary yields no winner (other rule types still unimplemented — fallback chain marks as exhausted)', async () => {
  const { db } = makeFirestore();
  const roleId = await seedRoleProfile(db);
  // No assignments — primary will return null.

  const r = await resolveAssignment({
    db,
    rule: {
      type: 'role',
      roleProfileId: roleId,
      fallback: [
        { type: 'department', departmentId: 'dept_creative' },
        { type: 'manager', userId: 'EMP-some-manager' },
      ],
    },
    context: { eventType: 'creative.internal_approval_requested' },
  });

  // No winner, but the chain was attempted and (since both fallback types
  // are still unimplemented in 6.A.1) skipped cleanly without propagating
  // the `unimplemented` error.
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.fallbackChainExhausted, 'department → manager');
});

// ----- internals ------------------------------------------------------

test('toDate handles Date, ISO string, Firestore Timestamp, {seconds}', () => {
  const { toDate } = _internals;
  const d = new Date('2026-05-24T10:00:00Z');
  assert.equal(toDate(d).toISOString(), d.toISOString());
  assert.equal(toDate('2026-05-24T10:00:00Z').toISOString(), d.toISOString());
  assert.equal(toDate({ toDate: () => d }).toISOString(), d.toISOString());
  assert.equal(toDate({ seconds: d.getTime() / 1000 }).toISOString(), d.toISOString());
  assert.equal(toDate(null), null);
  assert.equal(toDate(undefined), null);
});

test('withinEffectiveWindow rejects pre-start and post-end', () => {
  const { withinEffectiveWindow } = _internals;
  const now = new Date('2026-05-24');
  assert.equal(
    withinEffectiveWindow({ effectiveFrom: '2026-06-01' }, now),
    false,
    'pre-start'
  );
  assert.equal(
    withinEffectiveWindow({ effectiveFrom: '2026-01-01', effectiveTo: '2026-02-01' }, now),
    false,
    'post-end'
  );
  assert.equal(
    withinEffectiveWindow({ effectiveFrom: '2026-01-01' }, now),
    true,
    'open-ended'
  );
  assert.equal(
    withinEffectiveWindow({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' }, now),
    true,
    'within window'
  );
});
