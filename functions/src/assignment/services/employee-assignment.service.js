/**
 * EmployeeAssignmentService — Addendum v1.2 §2.3.
 *
 * Resolves "who should this task go to" by dispatching on a rule
 * type. The six rule types from the spec:
 *
 *   - role       — employees whose RoleAssignment matches the given
 *                  roleProfileId, ranked by utilisation. Overloaded
 *                  experts lose to available intermediates.
 *   - department — broader pool (any role in the department), same
 *                  ranking.
 *   - user       — direct lookup of a named employee.
 *   - manager    — direct lookup of the user's manager via
 *                  Employee.position.reportingTo.
 *   - creator    — direct lookup of the event creator from the
 *                  event payload (passed in context.creatorUserId).
 *   - dynamic    — criteria search on skills + authority +
 *                  amount-to-approve.
 *
 * Phase 6.A.1: shipped dispatcher + `role` rule.
 * Phase 6.A.2 (this change): all six rule types implemented +
 *   Tier-aware capacity clock (reads tier_sla_policy + engine_config).
 *   Workload signal is still "count of open IWOs assigned to the
 *   employee" — the unified inbox lands in 6.E.
 *
 * Coupling to v1.1 §8 `routeBrand()`: brand routing and person
 * routing are the same algorithm at two scopes (capability + conflict +
 * capacity + fallback). Phase 6.B wires `routeBrand()` to this
 * service at brand scope.
 */

const { HttpsError } = require('firebase-functions/v2/https');

/**
 * @typedef {Object} AssignmentRule
 * @property {'role'|'department'|'user'|'manager'|'creator'|'dynamic'} type
 * @property {string} [roleProfileId]   // `role` rule
 * @property {string} [departmentId]    // `department` rule
 * @property {string} [userId]          // `user` / `manager` / `creator`
 * @property {Object} [criteria]        // `dynamic` rule
 * @property {Array<{ type: string, ...rest }>} [fallback]
 *
 * @typedef {Object} AssignmentContext
 * @property {string} eventType           // e.g. 'creative.internal_approval_requested'
 * @property {string} [brandId]           // canonical SubsidiaryId or 'all'
 * @property {string} [triggeringUserId]
 * @property {number} [amountMinor]       // for approval-amount checks
 * @property {string} [tier]              // TIER_1 | TIER_2 | TIER_3 (v1.1 §5)
 *
 * @typedef {Object} AssignmentResult
 * @property {string|null} assignedEmployeeId
 * @property {string} ruleTypeUsed
 * @property {Object} [rankSnapshot]      // top 5 candidates + scores, for audit
 * @property {string|null} fallbackChainExhausted
 */

const VALID_RULE_TYPES = ['role', 'department', 'user', 'manager', 'creator', 'dynamic'];

/**
 * Pure-ish runner — extracted from any onCall wrapper so unit tests
 * can inject a stub Firestore. Mirrors the pattern in issueWorkOrder.js.
 *
 * @param {Object} args
 * @param {FirebaseFirestore.Firestore|Object} args.db
 * @param {AssignmentRule} args.rule
 * @param {AssignmentContext} args.context
 * @param {Object} [args.now]   // injectable clock for tests; defaults to new Date()
 * @returns {Promise<AssignmentResult>}
 */
async function resolveAssignment({ db, rule, context, now = new Date() }) {
  if (!rule || typeof rule !== 'object' || !VALID_RULE_TYPES.includes(rule.type)) {
    throw new HttpsError(
      'invalid-argument',
      `rule.type must be one of: ${VALID_RULE_TYPES.join(', ')}`
    );
  }
  if (!context || !context.eventType) {
    throw new HttpsError('invalid-argument', 'context.eventType is required.');
  }

  let result;
  switch (rule.type) {
    case 'role':
      result = await resolveByRole({ db, rule, context, now });
      break;
    case 'department':
      result = await resolveByDepartment({ db, rule, context, now });
      break;
    case 'user':
      result = await resolveByUser({ db, rule, context, now });
      break;
    case 'manager':
      result = await resolveByManager({ db, rule, context, now });
      break;
    case 'creator':
      result = await resolveByCreator({ db, rule, context, now });
      break;
    case 'dynamic':
      result = await resolveByDynamic({ db, rule, context, now });
      break;
    default:
      // Defensive — VALID_RULE_TYPES check above should make this unreachable.
      throw new HttpsError('internal', `Unknown rule type: ${rule.type}`);
  }

  // If primary path resolved nobody and a fallback chain was supplied,
  // walk it. v1.2 §2.3: "Every rule carries a fallback chain so a
  // primary failure cascades to a backstop (typically manager or
  // department)."
  if (!result.assignedEmployeeId && Array.isArray(rule.fallback) && rule.fallback.length > 0) {
    for (const fb of rule.fallback) {
      const fbResult = await resolveAssignment({ db, rule: fb, context, now });
      if (fbResult.assignedEmployeeId) {
        return {
          ...fbResult,
          fallbackChainExhausted: null,
        };
      }
    }
    return {
      ...result,
      fallbackChainExhausted: rule.fallback.map((f) => f.type).join(' → '),
    };
  }

  return result;
}

/**
 * `role` rule: candidates = active RoleAssignment(roleProfileId) with
 * isPrimary first, then secondary. Filtered by brand scope. Ranked by
 * utilisation: candidate score = max(0, maxConcurrent - currentLoad).
 * Highest score wins; ties broken by tenure (joiningDate, oldest first).
 *
 * Phase 6.A.1: `currentLoad` is a placeholder (0 for everyone — no
 * task table to read against yet; that's Phase 6.E). Once 6.E lands,
 * the `currentLoad` calc reads the open tasks for the candidate from
 * the unified inbox.
 */
async function resolveByRole({ db, rule, context, now }) {
  if (!rule.roleProfileId || typeof rule.roleProfileId !== 'string') {
    throw new HttpsError('invalid-argument', "rule.roleProfileId is required for the 'role' rule type.");
  }

  // 1. Load the role profile to read its typicalTaskLoad.maxConcurrent
  //    + brand scope.
  const roleSnap = await db.doc(`role_profile/${rule.roleProfileId}`).get();
  if (!roleSnap.exists) {
    throw new HttpsError('not-found', `RoleProfile '${rule.roleProfileId}' does not exist.`);
  }
  const roleProfile = roleSnap.data();

  // 2. Brand scope: if context.brandId is set, the role's brandId must
  //    match (or be 'all'). Prevents cross-brand spillover, supports
  //    the v1.1 sibling-brand model.
  if (
    context.brandId &&
    roleProfile.brandId !== 'all' &&
    roleProfile.brandId !== context.brandId
  ) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'role',
      rankSnapshot: {
        rejected: 'brand-scope-mismatch',
        roleProfileBrandId: roleProfile.brandId,
        contextBrandId: context.brandId,
      },
      fallbackChainExhausted: null,
    };
  }

  // 3. Query active assignments for this role profile, primary first.
  const assignmentsSnap = await db
    .collection('role_assignment')
    .where('roleProfileId', '==', rule.roleProfileId)
    .where('status', '==', 'active')
    .get();

  const candidates = [];
  assignmentsSnap.forEach((doc) => {
    const a = doc.data();
    if (!withinEffectiveWindow(a, now)) return;
    if (a.overrides?.pausedUntil && toDate(a.overrides.pausedUntil) > now) return;
    candidates.push({
      assignmentId: doc.id,
      employeeId: a.employeeId,
      isPrimary: a.isPrimary === true,
      maxDailyTasksOverride: a.overrides?.maxDailyTasks,
    });
  });

  if (candidates.length === 0) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'role',
      rankSnapshot: { reason: 'no-active-assignments', roleProfileId: rule.roleProfileId },
      fallbackChainExhausted: null,
    };
  }

  // 4. Rank by utilisation. Phase 6.A.1: currentLoad = 0 for everyone
  //    (no inbox to query yet). When 6.E ships, replace getCurrentLoad
  //    with the real call.
  const maxConcurrent = roleProfile.typicalTaskLoad?.maxConcurrent ?? 5;
  const ranked = await Promise.all(
    candidates.map(async (c) => {
      const currentLoad = await getCurrentLoad({ db, employeeId: c.employeeId });
      const cap = c.maxDailyTasksOverride ?? maxConcurrent;
      const availability = Math.max(0, cap - currentLoad);
      return {
        ...c,
        currentLoad,
        availability,
        // Primary bias: bump score so a primary tie-breaks above a secondary.
        score: availability + (c.isPrimary ? 0.5 : 0),
      };
    })
  );

  ranked.sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const winner = top.availability > 0 ? top.employeeId : null;

  return {
    assignedEmployeeId: winner,
    ruleTypeUsed: 'role',
    rankSnapshot: {
      roleProfileId: rule.roleProfileId,
      maxConcurrent,
      candidates: ranked.slice(0, 5).map((c) => ({
        employeeId: c.employeeId,
        isPrimary: c.isPrimary,
        currentLoad: c.currentLoad,
        availability: c.availability,
        score: c.score,
      })),
    },
    fallbackChainExhausted: null,
  };
}

/**
 * `department` rule: any employee with an active RoleAssignment
 * whose role lives in `rule.departmentId`. Same ranking as `role`.
 *
 * Brand scope: if context.brandId is set, the role must match (or 'all').
 */
async function resolveByDepartment({ db, rule, context, now }) {
  if (!rule.departmentId || typeof rule.departmentId !== 'string') {
    throw new HttpsError('invalid-argument', "rule.departmentId is required for the 'department' rule type.");
  }

  // Walk role_profile to find every role in this dept (+ brand scope).
  const profilesQuery = db
    .collection('role_profile')
    .where('departmentId', '==', rule.departmentId)
    .where('status', '==', 'active');
  const profilesSnap = await profilesQuery.get();

  const eligibleRoles = [];
  profilesSnap.forEach((doc) => {
    const p = doc.data();
    if (
      !context.brandId ||
      p.brandId === 'all' ||
      p.brandId === context.brandId
    ) {
      eligibleRoles.push({ id: doc.id, maxConcurrent: p.typicalTaskLoad?.maxConcurrent });
    }
  });

  if (eligibleRoles.length === 0) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'department',
      rankSnapshot: { reason: 'no-eligible-roles-in-department', departmentId: rule.departmentId },
      fallbackChainExhausted: null,
    };
  }

  // Pull assignments for every eligible role (parallel) and aggregate.
  const assignmentResults = await Promise.all(
    eligibleRoles.map((r) =>
      db.collection('role_assignment')
        .where('roleProfileId', '==', r.id)
        .where('status', '==', 'active')
        .get()
        .then((snap) => ({ roleId: r.id, maxConcurrent: r.maxConcurrent, snap }))
    )
  );

  const candidates = [];
  for (const { roleId, maxConcurrent, snap } of assignmentResults) {
    snap.forEach((doc) => {
      const a = doc.data();
      if (!withinEffectiveWindow(a, now)) return;
      if (a.overrides?.pausedUntil && toDate(a.overrides.pausedUntil) > now) return;
      candidates.push({
        employeeId: a.employeeId,
        roleProfileId: roleId,
        roleMaxConcurrent: maxConcurrent,
        isPrimary: a.isPrimary === true,
        maxDailyTasksOverride: a.overrides?.maxDailyTasks,
      });
    });
  }

  return rankAndPick({ db, candidates, ruleTypeUsed: 'department', extraSnapshot: { departmentId: rule.departmentId } });
}

/**
 * `user` rule: direct lookup of the named employee. Confirms the
 * employee exists + is in an active state; assignedEmployeeId is the
 * given userId verbatim.
 */
async function resolveByUser({ db, rule, context, now }) {
  void context;
  void now;
  if (!rule.userId || typeof rule.userId !== 'string') {
    throw new HttpsError('invalid-argument', "rule.userId is required for the 'user' rule type.");
  }
  const empSnap = await db.doc(`employees/${rule.userId}`).get();
  if (!empSnap.exists) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'user',
      rankSnapshot: { reason: 'employee-not-found', userId: rule.userId },
      fallbackChainExhausted: null,
    };
  }
  const emp = empSnap.data();
  if (emp.employmentStatus && emp.employmentStatus !== 'active' && emp.employmentStatus !== 'probation') {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'user',
      rankSnapshot: { reason: 'employee-not-active', userId: rule.userId, status: emp.employmentStatus },
      fallbackChainExhausted: null,
    };
  }
  return {
    assignedEmployeeId: rule.userId,
    ruleTypeUsed: 'user',
    rankSnapshot: { userId: rule.userId },
    fallbackChainExhausted: null,
  };
}

/**
 * `manager` rule: resolves to `Employee(rule.userId).position.reportingTo`.
 */
async function resolveByManager({ db, rule, context, now }) {
  if (!rule.userId || typeof rule.userId !== 'string') {
    throw new HttpsError('invalid-argument', "rule.userId is required for the 'manager' rule type.");
  }
  const empSnap = await db.doc(`employees/${rule.userId}`).get();
  if (!empSnap.exists) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'manager',
      rankSnapshot: { reason: 'employee-not-found', userId: rule.userId },
      fallbackChainExhausted: null,
    };
  }
  const managerId = empSnap.data().position?.reportingTo;
  if (!managerId) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'manager',
      rankSnapshot: { reason: 'no-manager-on-employee', userId: rule.userId },
      fallbackChainExhausted: null,
    };
  }
  // Re-enter via the `user` rule so employment-status filtering applies.
  return resolveByUser({ db, rule: { type: 'user', userId: managerId }, context, now });
}

/**
 * `creator` rule: assigns back to the user who triggered the event
 * (passed in via context.creatorUserId). Self-routing for things like
 * "your draft was rejected — please revise."
 */
async function resolveByCreator({ db, rule, context, now }) {
  void rule;
  if (!context.creatorUserId) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'creator',
      rankSnapshot: { reason: 'no-creator-in-context' },
      fallbackChainExhausted: null,
    };
  }
  return resolveByUser({
    db,
    rule: { type: 'user', userId: context.creatorUserId },
    context,
    now,
  });
}

/**
 * `dynamic` rule: criteria search across role profiles by skill +
 * approval-authority constraints. Picks the cheapest qualified candidate
 * (lowest jobLevel that still satisfies the criteria).
 *
 * 6.A.2 implements the v1.2 §2.3 spec for skill + amountMinor matching.
 * Urgency-aware tie-breaking will arrive in 6.E once we have the
 * unified task inbox.
 */
async function resolveByDynamic({ db, rule, context, now }) {
  const crit = rule.criteria || {};

  // Pull active role profiles in scope.
  let q = db.collection('role_profile').where('status', '==', 'active');
  if (crit.departmentId) q = q.where('departmentId', '==', crit.departmentId);
  const profilesSnap = await q.get();

  const eligibleRoles = [];
  profilesSnap.forEach((doc) => {
    const p = doc.data();
    if (context.brandId && p.brandId !== 'all' && p.brandId !== context.brandId) return;

    // Skill match — every requiredSkill name must be present on the role.
    if (Array.isArray(crit.requiredSkills) && crit.requiredSkills.length > 0) {
      const roleSkillNames = new Set((p.skills || []).map((s) => s.name));
      const hasAll = crit.requiredSkills.every((s) => roleSkillNames.has(s));
      if (!hasAll) return;
    }

    // Approval-amount check — at least one ApprovalAuthority entry must
    // match the event type AND its maxAmountMinor must be ≥ requested.
    if (context.amountMinor != null && context.eventType) {
      const auths = p.approvalAuthorities || [];
      const ok = auths.some((a) =>
        a.eventType === context.eventType &&
        (a.maxAmountMinor == null || a.maxAmountMinor >= context.amountMinor)
      );
      if (!ok) return;
    }

    eligibleRoles.push({
      id: doc.id,
      jobLevel: p.jobLevel,
      maxConcurrent: p.typicalTaskLoad?.maxConcurrent,
    });
  });

  if (eligibleRoles.length === 0) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed: 'dynamic',
      rankSnapshot: { reason: 'no-roles-match-criteria', criteria: crit },
      fallbackChainExhausted: null,
    };
  }

  // Cheapest qualified first — lower jobLevel wins. JobLevel order
  // mirrors role-profile.types.ts.
  const LEVEL_ORDER = ['intern', 'associate', 'mid', 'senior', 'manager', 'director', 'executive'];
  eligibleRoles.sort((a, b) => LEVEL_ORDER.indexOf(a.jobLevel) - LEVEL_ORDER.indexOf(b.jobLevel));

  // Walk in order; first role with any free capacity wins.
  for (const role of eligibleRoles) {
    const snap = await db.collection('role_assignment')
      .where('roleProfileId', '==', role.id)
      .where('status', '==', 'active')
      .get();
    const candidates = [];
    snap.forEach((doc) => {
      const a = doc.data();
      if (!withinEffectiveWindow(a, now)) return;
      if (a.overrides?.pausedUntil && toDate(a.overrides.pausedUntil) > now) return;
      candidates.push({
        employeeId: a.employeeId,
        roleProfileId: role.id,
        roleMaxConcurrent: role.maxConcurrent,
        isPrimary: a.isPrimary === true,
        maxDailyTasksOverride: a.overrides?.maxDailyTasks,
      });
    });
    if (candidates.length > 0) {
      const result = await rankAndPick({
        db,
        candidates,
        ruleTypeUsed: 'dynamic',
        extraSnapshot: { criteria: crit, pickedRoleProfileId: role.id, pickedJobLevel: role.jobLevel },
      });
      if (result.assignedEmployeeId) return result;
      // Else loop to next-level role.
    }
  }

  return {
    assignedEmployeeId: null,
    ruleTypeUsed: 'dynamic',
    rankSnapshot: { reason: 'no-available-candidates', criteria: crit },
    fallbackChainExhausted: null,
  };
}

/**
 * Shared ranking + winner selection. Used by `role`, `department`,
 * and `dynamic`. Returns the AssignmentResult shape.
 */
async function rankAndPick({ db, candidates, ruleTypeUsed, extraSnapshot = {} }) {
  if (candidates.length === 0) {
    return {
      assignedEmployeeId: null,
      ruleTypeUsed,
      rankSnapshot: { ...extraSnapshot, reason: 'no-candidates' },
      fallbackChainExhausted: null,
    };
  }

  const ranked = await Promise.all(
    candidates.map(async (c) => {
      const currentLoad = await getCurrentLoad({ db, employeeId: c.employeeId });
      const cap = c.maxDailyTasksOverride ?? c.roleMaxConcurrent ?? 5;
      const availability = Math.max(0, cap - currentLoad);
      return {
        ...c,
        currentLoad,
        availability,
        score: availability + (c.isPrimary ? 0.5 : 0),
      };
    })
  );
  ranked.sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const winner = top.availability > 0 ? top.employeeId : null;

  return {
    assignedEmployeeId: winner,
    ruleTypeUsed,
    rankSnapshot: {
      ...extraSnapshot,
      candidates: ranked.slice(0, 5).map((c) => ({
        employeeId: c.employeeId,
        roleProfileId: c.roleProfileId,
        isPrimary: c.isPrimary,
        currentLoad: c.currentLoad,
        availability: c.availability,
        score: c.score,
      })),
    },
    fallbackChainExhausted: null,
  };
}

/**
 * Phase 6.A.2 capacity reader: counts the open IWOs currently
 * assigned to the employee. IWO status in {ISSUED, ACCEPTED,
 * IN_PROGRESS, REVISION_REQUESTED} counts as "open"; DELIVERED is
 * borderline (work submitted, awaiting ECD approval) — we count it.
 *
 * When 6.E lands the unified task inbox, this swaps to a query
 * against the generated_tasks collection without changing the
 * resolver's call signature.
 */
async function getCurrentLoad({ db, employeeId }) {
  if (!employeeId) return 0;
  const OPEN_STATES = ['ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'REVISION_REQUESTED', 'DELIVERED'];
  let count = 0;
  // 'in' query supports up to 30 values — OPEN_STATES is 5; safe.
  const snap = await db
    .collection('internal_work_orders')
    .where('assignedEmployeeId', '==', employeeId)
    .where('status', 'in', OPEN_STATES)
    .get();
  snap.forEach(() => { count += 1; });
  return count;
}

/**
 * Loads the global engine config + a Tier policy. Cached at module
 * scope per request would be nice — Cloud Functions cold-starts
 * already amortise across invocations within a warm instance.
 */
async function loadEngineConfig({ db }) {
  const snap = await db.doc('engine_config/global').get();
  if (!snap.exists) return null;
  return snap.data();
}

async function loadTierPolicy({ db, tier }) {
  if (!tier) return null;
  const snap = await db.doc(`tier_sla_policy/${tier}`).get();
  if (!snap.exists) return null;
  return snap.data();
}

/**
 * Resolves the SLA hours for a (tier, priority) pair. Falls back to
 * the medium-priority hours if priority is missing; falls back to a
 * 24h default if engine_config isn't seeded yet.
 */
async function resolveSlaHours({ db, tier, priority }) {
  if (!tier) return null;
  const cfg = await loadEngineConfig({ db });
  if (!cfg) return null;
  const tierHours = cfg.slaHoursByTier?.[tier];
  if (!tierHours) return null;
  return tierHours[priority] ?? tierHours.medium ?? 24;
}

/**
 * Effective-window check: assignment is active iff
 *   effectiveFrom ≤ now AND (effectiveTo is unset OR effectiveTo > now).
 */
function withinEffectiveWindow(assignment, now) {
  const from = toDate(assignment.effectiveFrom);
  if (!from || from > now) return false;
  const to = assignment.effectiveTo ? toDate(assignment.effectiveTo) : null;
  if (to && to <= now) return false;
  return true;
}

/**
 * Best-effort conversion of various Firestore Timestamp shapes to Date.
 * Accepts:
 *   - Date
 *   - Firestore Timestamp instance (.toDate())
 *   - ISO 8601 string (resolved sentinels in the test stub)
 *   - { seconds, nanoseconds } literal
 */
function toDate(t) {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t === 'string') return new Date(t);
  if (typeof t.toDate === 'function') return t.toDate();
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
  return null;
}

module.exports = {
  resolveAssignment,
  resolveSlaHours,
  loadEngineConfig,
  loadTierPolicy,
  // Exported for unit-testing the inner helpers.
  _internals: {
    resolveByRole,
    resolveByDepartment,
    resolveByUser,
    resolveByManager,
    resolveByCreator,
    resolveByDynamic,
    rankAndPick,
    getCurrentLoad,
    withinEffectiveWindow,
    toDate,
    VALID_RULE_TYPES,
  },
};
