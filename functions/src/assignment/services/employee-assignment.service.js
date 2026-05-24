/**
 * EmployeeAssignmentService — Addendum v1.2 §2.3.
 *
 * Resolves "who should this task go to" by dispatching on a rule
 * type. The four rule types from the spec:
 *
 *   - role     — employees whose primary RoleAssignment matches the
 *                given roleProfileId, ranked by current utilisation.
 *                Overloaded experts lose to available intermediates.
 *   - department — broader pool (any role in the department), same
 *                ranking.
 *   - user|manager|creator — direct lookups by the event's triggering
 *                user (or the user's manager / the event's creator).
 *   - dynamic  — criteria search on skills + authority + amount-to-
 *                approve + urgency.
 *
 * Phase 6.A.1 (this PR): ships the dispatcher + `role` rule. The
 * other three rule types throw `unimplemented`. The fallback chain
 * is wired but only the primary path is exercised.
 *
 * Coupling to Addendum v1.1 §5 (Tier System) lands in 6.A.2 — the
 * SLA clock that drives `capacityWithin(...)` is currently a stub.
 *
 * Coupling to v1.1 §8 `routeBrand()`: brand routing and person
 * routing are the same algorithm at two scopes (capability + conflict +
 * capacity + fallback). Once a brand is chosen by `routeBrand()`,
 * this service picks the people within it.
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
    case 'user':
    case 'manager':
    case 'creator':
    case 'dynamic':
      throw new HttpsError(
        'unimplemented',
        `Rule type '${rule.type}' lands in Phase 6.A.2. Today only 'role' is wired.`
      );
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
      try {
        const fbResult = await resolveAssignment({
          db,
          rule: fb,
          context,
          now,
        });
        if (fbResult.assignedEmployeeId) {
          return {
            ...fbResult,
            fallbackChainExhausted: null,
          };
        }
      } catch (err) {
        // Skip unimplemented fallbacks until 6.A.2 lands the other rule types.
        if (err.code !== 'unimplemented') throw err;
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
 * Placeholder workload reader. Phase 6.A.1 returns 0 for everyone —
 * the unified task inbox is Phase 6.E. The shape lets us swap a real
 * query without changing the resolver.
 */
async function getCurrentLoad({ db, employeeId }) {
  void db;
  void employeeId;
  return 0;
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
  // Exported for unit-testing the inner helpers.
  _internals: {
    resolveByRole,
    withinEffectiveWindow,
    toDate,
    VALID_RULE_TYPES,
  },
};
