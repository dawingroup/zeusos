/**
 * The approval policy — who may be recorded as an approver.
 *
 * ADR-2026-10-25 (approvals need a human) point 4: no writer — agent,
 * script, consumer or otherwise — may move a record into an approved state
 * without naming a human. A synthetic actor satisfies an attribution check
 * while naming nobody, which is precisely the failure the ADR exists to
 * close. In ZeusOS the pre-ADR talent-invoice panel approved with the
 * literal string 'current-user'; every row it approved has no approver.
 *
 * Ported from DawinOS `functions/src/lib/approvalPolicy.js`. The TypeScript
 * mirror for the client is `src/modules/approvals/routing/policy.ts`; the
 * lockstep test pins the two lists together.
 */

'use strict';

/** Actor strings that name a machine, a placeholder, or nobody. */
const MACHINE_ACTOR_PATTERNS = [
  /^mcp-agent$/i,
  /^agent:/i,
  /^system:/i,
  /^SYSTEM_/,
  /^seed-script$/i,
  /^unknown$/i,
  /^current-user$/i,
  /^user$/i,
  /^system$/i,
];

/**
 * True when `actor` names a machine, a placeholder, or names nobody at all.
 * An absent actor counts as non-human on purpose: callers are asking "may
 * this approve?", and the answer for a missing actor is no.
 */
function isMachineActor(actor) {
  if (typeof actor !== 'string') return true;
  const v = actor.trim();
  if (v === '') return true;
  return MACHINE_ACTOR_PATTERNS.some((re) => re.test(v));
}

module.exports = { MACHINE_ACTOR_PATTERNS, isMachineActor };
