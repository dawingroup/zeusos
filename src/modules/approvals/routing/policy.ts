/**
 * The approval policy — who may be recorded as an approver. Client mirror of
 * `functions/src/approvals/policy.js`; the lockstep test pins the two lists.
 *
 * ADR-2026-10-25: no writer may move a record into an approved state without
 * naming a human. The pre-ADR talent panel approved as 'current-user'.
 */

export const MACHINE_ACTOR_PATTERNS: RegExp[] = [
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

/** True when `actor` names a machine, a placeholder, or nobody at all. */
export function isMachineActor(actor: unknown): boolean {
  if (typeof actor !== 'string') return true;
  const v = actor.trim();
  if (v === '') return true;
  return MACHINE_ACTOR_PATTERNS.some((re) => re.test(v));
}
