/**
 * EmployeeAssignmentService — Phase 6.A.2 additions.
 *   cd functions && node --test __tests__/assignment/employee-assignment-6a2.test.js
 *
 * Covers the 5 rule types now wired (department / user / manager /
 * creator / dynamic) + the Tier-SLA / engine-config helpers. The
 * `role` rule + dispatcher + internals are covered in the 6.A.1 file
 * next to this one.
 *
 * Stub limitations to keep in mind while reading:
 *   - The in-memory stub only supports `==` filters and ignores `in`
 *     queries (returns nothing). That means `getCurrentLoad` reads
 *     0 here for everyone — same as it did in 6.A.1 — and the
 *     ranking-by-real-load behaviour is exercised in integration
 *     tests against the emulator (separate harness; Phase 6.E).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('./_firestore-stub');
const {
  resolveAssignment,
  resolveSlaHours,
  loadEngineConfig,
  loadTierPolicy,
} = require('../../src/assignment/services/employee-assignment.service');

// ----- shared seed helpers --------------------------------------------

async function seedRoleProfile(db, overrides = {}) {
  const id = overrides.id || `ROLE-${Math.random().toString(36).slice(2, 9)}`;
  await db.doc(`role_profile/${id}`).set({
    id,
    brandId: overrides.brandId ?? 'zeus-the-agency',
    departmentId: overrides.departmentId ?? 'dept_creative',
    jobLevel: overrides.jobLevel ?? 'senior',
    employmentTypes: ['permanent'],
    title: overrides.title ?? 'Test Role',
    reportsTo: [],
    supervises: [],
    peers: [],
    escalationPath: [],
    delegationPool: [],
    skills: overrides.skills ?? [],
    taskCapabilities: [],
    approvalAuthorities: overrides.approvalAuthorities ?? [],
    typicalTaskLoad: overrides.typicalTaskLoad ?? { daily: 4, weekly: 20, maxConcurrent: 3 },
    aiContext: { briefingPriorities: [], taskSortingWeights: {}, communicationStyle: 'concise' },
    status: overrides.status ?? 'active',
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

async function seedEmployee(db, id, overrides = {}) {
  await db.doc(`employees/${id}`).set({
    id,
    employmentStatus: overrides.employmentStatus ?? 'active',
    position: {
      title: overrides.title ?? 'Senior Designer',
      departmentId: overrides.departmentId ?? 'dept_creative',
      reportingTo: overrides.reportingTo,
      location: 'Kampala',
      isManagement: false,
    },
  });
}

// ====== department rule ===============================================

test('department rule: rejects missing departmentId', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => resolveAssignment({
      db,
      rule: { type: 'department' },
      context: { eventType: 'creative.internal_approval_requested' },
    }),
    /rule\.departmentId is required/
  );
});

test('department rule: no roles in dept → no winner', async () => {
  const { db } = makeFirestore();
  const r = await resolveAssignment({
    db,
    rule: { type: 'department', departmentId: 'dept_empty' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'no-eligible-roles-in-department');
});

test('department rule: aggregates assignments across multiple roles in the dept', async () => {
  const { db } = makeFirestore();
  const role1 = await seedRoleProfile(db, { id: 'R1', departmentId: 'dept_creative', title: 'Designer' });
  const role2 = await seedRoleProfile(db, { id: 'R2', departmentId: 'dept_creative', title: 'Copywriter' });
  await seedRoleAssignment(db, { employeeId: 'EMP-designer', roleProfileId: role1, isPrimary: true });
  await seedRoleAssignment(db, { employeeId: 'EMP-copywriter', roleProfileId: role2, isPrimary: true });

  const r = await resolveAssignment({
    db,
    rule: { type: 'department', departmentId: 'dept_creative' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.ruleTypeUsed, 'department');
  assert.ok(['EMP-designer', 'EMP-copywriter'].includes(r.assignedEmployeeId));
  assert.equal(r.rankSnapshot.candidates.length, 2);
});

test('department rule: brand-scope filtering excludes other-brand roles', async () => {
  const { db } = makeFirestore();
  await seedRoleProfile(db, { id: 'R-zta', brandId: 'zeus-the-agency', departmentId: 'dept_creative' });
  await seedRoleProfile(db, { id: 'R-zd', brandId: 'zeus-digital', departmentId: 'dept_creative' });
  await seedRoleAssignment(db, { employeeId: 'EMP-zta', roleProfileId: 'R-zta', isPrimary: true });
  await seedRoleAssignment(db, { employeeId: 'EMP-zd', roleProfileId: 'R-zd', isPrimary: true });

  const r = await resolveAssignment({
    db,
    rule: { type: 'department', departmentId: 'dept_creative' },
    context: { eventType: 'iwo.sla_due_soon', brandId: 'zeus-the-agency' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-zta');
});

// ====== user rule =====================================================

test('user rule: rejects missing userId', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => resolveAssignment({ db, rule: { type: 'user' }, context: { eventType: 'x.y' } }),
    /rule\.userId is required/
  );
});

test('user rule: employee not found → null', async () => {
  const { db } = makeFirestore();
  const r = await resolveAssignment({
    db,
    rule: { type: 'user', userId: 'EMP-ghost' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'employee-not-found');
});

test('user rule: active employee → direct assignment', async () => {
  const { db } = makeFirestore();
  await seedEmployee(db, 'EMP-alice');
  const r = await resolveAssignment({
    db,
    rule: { type: 'user', userId: 'EMP-alice' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-alice');
  assert.equal(r.ruleTypeUsed, 'user');
});

test('user rule: terminated employee → null', async () => {
  const { db } = makeFirestore();
  await seedEmployee(db, 'EMP-gone', { employmentStatus: 'terminated' });
  const r = await resolveAssignment({
    db,
    rule: { type: 'user', userId: 'EMP-gone' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'employee-not-active');
});

// ====== manager rule ==================================================

test('manager rule: employee has no reportingTo → null', async () => {
  const { db } = makeFirestore();
  await seedEmployee(db, 'EMP-orphan', { reportingTo: null });
  const r = await resolveAssignment({
    db,
    rule: { type: 'manager', userId: 'EMP-orphan' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'no-manager-on-employee');
});

test('manager rule: resolves to the configured reportingTo', async () => {
  const { db } = makeFirestore();
  await seedEmployee(db, 'EMP-bob', { reportingTo: 'EMP-bob-manager' });
  await seedEmployee(db, 'EMP-bob-manager');
  const r = await resolveAssignment({
    db,
    rule: { type: 'manager', userId: 'EMP-bob' },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-bob-manager');
  assert.equal(r.ruleTypeUsed, 'user'); // resolveByManager delegates to resolveByUser at the end
});

// ====== creator rule ==================================================

test('creator rule: no context.creatorUserId → null', async () => {
  const { db } = makeFirestore();
  const r = await resolveAssignment({
    db,
    rule: { type: 'creator' },
    context: { eventType: 'creative.revision_requested' },
  });
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'no-creator-in-context');
});

test('creator rule: resolves to context.creatorUserId', async () => {
  const { db } = makeFirestore();
  await seedEmployee(db, 'EMP-carla');
  const r = await resolveAssignment({
    db,
    rule: { type: 'creator' },
    context: { eventType: 'creative.revision_requested', creatorUserId: 'EMP-carla' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-carla');
});

// ====== dynamic rule ==================================================

test('dynamic rule: no roles match criteria → null + criteria in snapshot', async () => {
  const { db } = makeFirestore();
  const r = await resolveAssignment({
    db,
    rule: { type: 'dynamic', criteria: { departmentId: 'dept_void' } },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, null);
  assert.equal(r.rankSnapshot.reason, 'no-roles-match-criteria');
});

test('dynamic rule: picks cheapest qualified jobLevel (mid < senior)', async () => {
  const { db } = makeFirestore();
  await seedRoleProfile(db, { id: 'R-mid', jobLevel: 'mid', departmentId: 'dept_creative' });
  await seedRoleProfile(db, { id: 'R-senior', jobLevel: 'senior', departmentId: 'dept_creative' });
  await seedRoleAssignment(db, { employeeId: 'EMP-midlevel', roleProfileId: 'R-mid', isPrimary: true });
  await seedRoleAssignment(db, { employeeId: 'EMP-senior', roleProfileId: 'R-senior', isPrimary: true });

  const r = await resolveAssignment({
    db,
    rule: { type: 'dynamic', criteria: { departmentId: 'dept_creative' } },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-midlevel');
  assert.equal(r.rankSnapshot.pickedJobLevel, 'mid');
});

test('dynamic rule: requiredSkills filter excludes roles missing the skill', async () => {
  const { db } = makeFirestore();
  await seedRoleProfile(db, {
    id: 'R-generalist',
    jobLevel: 'mid',
    departmentId: 'dept_creative',
    skills: [{ category: 'design', name: 'figma', requiredLevel: 'intermediate', isCore: true }],
  });
  await seedRoleProfile(db, {
    id: 'R-specialist',
    jobLevel: 'senior',
    departmentId: 'dept_creative',
    skills: [
      { category: 'design', name: 'figma', requiredLevel: 'expert', isCore: true },
      { category: 'design', name: 'after_effects', requiredLevel: 'advanced', isCore: false },
    ],
  });
  await seedRoleAssignment(db, { employeeId: 'EMP-spec', roleProfileId: 'R-specialist', isPrimary: true });
  await seedRoleAssignment(db, { employeeId: 'EMP-gen', roleProfileId: 'R-generalist', isPrimary: true });

  const r = await resolveAssignment({
    db,
    rule: { type: 'dynamic', criteria: { departmentId: 'dept_creative', requiredSkills: ['after_effects'] } },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-spec'); // generalist excluded, specialist wins
});

test('dynamic rule: amountMinor authority gate', async () => {
  const { db } = makeFirestore();
  await seedRoleProfile(db, {
    id: 'R-manager',
    jobLevel: 'manager',
    departmentId: 'dept_finance',
    approvalAuthorities: [{ eventType: 'finance.budget_change_proposed', maxAmountMinor: 5_000_000 }],
  });
  await seedRoleProfile(db, {
    id: 'R-cfo',
    jobLevel: 'director',
    departmentId: 'dept_finance',
    approvalAuthorities: [{ eventType: 'finance.budget_change_proposed', maxAmountMinor: 100_000_000 }],
  });
  await seedRoleAssignment(db, { employeeId: 'EMP-manager', roleProfileId: 'R-manager', isPrimary: true });
  await seedRoleAssignment(db, { employeeId: 'EMP-cfo', roleProfileId: 'R-cfo', isPrimary: true });

  // 10M request: manager (5M cap) excluded, CFO (100M cap) wins.
  const r = await resolveAssignment({
    db,
    rule: { type: 'dynamic', criteria: { departmentId: 'dept_finance' } },
    context: { eventType: 'finance.budget_change_proposed', amountMinor: 10_000_000 },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-cfo');
});

// ====== fallback chain (now functional with multiple rule types) ======

test('fallback chain: department primary empty → manager fallback resolves', async () => {
  const { db } = makeFirestore();
  await seedEmployee(db, 'EMP-mgr');
  await seedEmployee(db, 'EMP-self', { reportingTo: 'EMP-mgr' });

  const r = await resolveAssignment({
    db,
    rule: {
      type: 'department',
      departmentId: 'dept_empty',
      fallback: [{ type: 'manager', userId: 'EMP-self' }],
    },
    context: { eventType: 'iwo.sla_due_soon' },
  });
  assert.equal(r.assignedEmployeeId, 'EMP-mgr');
  assert.equal(r.fallbackChainExhausted, null);
});

// ====== Tier-SLA helpers ==============================================

test('loadTierPolicy: returns null when tier not seeded', async () => {
  const { db } = makeFirestore();
  const policy = await loadTierPolicy({ db, tier: 'TIER_1' });
  assert.equal(policy, null);
});

test('loadEngineConfig + resolveSlaHours: returns priority-specific hours', async () => {
  const { db } = makeFirestore();
  await db.doc('engine_config/global').set({
    id: 'global',
    slaHoursByTier: {
      TIER_1: { critical: 24, high: 48, medium: 96, low: 168 },
      TIER_3: { critical: 4, high: 8, medium: 24, low: 72 },
    },
  });
  const cfg = await loadEngineConfig({ db });
  assert.equal(cfg.slaHoursByTier.TIER_1.critical, 24);

  assert.equal(await resolveSlaHours({ db, tier: 'TIER_1', priority: 'critical' }), 24);
  assert.equal(await resolveSlaHours({ db, tier: 'TIER_3', priority: 'critical' }), 4);
  // Unknown priority → medium fallback
  assert.equal(await resolveSlaHours({ db, tier: 'TIER_1', priority: 'nonexistent' }), 96);
});

test('resolveSlaHours: null when tier or config missing', async () => {
  const { db } = makeFirestore();
  assert.equal(await resolveSlaHours({ db, tier: null, priority: 'critical' }), null);
  assert.equal(await resolveSlaHours({ db, tier: 'TIER_1', priority: 'critical' }), null);
});
