/**
 * ECD Approval Ladder — Phase 6.D (closes Addendum v1.1 §7 / change C5).
 *
 * The 6-rung internal-acceptance chain that gates every IWO between
 * DELIVERED and ACCEPTED_INTERNALLY. v1.1 §7.1:
 *
 *   Designer/Writer → AD/Copywriter → Studio Mgr/Head of Copy →
 *     ACD (Associate Creative Director) → CD (Creative Director) →
 *     ECD (Executive Creative Director)
 *
 * Work is "DELIVERED" the moment it leaves the originator's hands; it
 * must then climb the ladder before it can reach the client (and before
 * the IWO transitions to ACCEPTED_INTERNALLY → CLOSED → IC invoice).
 *
 * A reject at any rung returns the work to the originator with
 * structured notes. The rejecting rung is logged for cycle-time
 * analytics + ECD Cycle-Time Watcher (ZA-003, Phase 6.F) — that
 * watcher is what surfaces "rejection-loop hotspot per brand chain".
 *
 * Tier governs ladder depth (v1.1 §7.1 / §5):
 *   TIER_1  → full 6-rung chain
 *   TIER_2  → standard 4-rung (DESIGNER → ACD → CD → ECD)
 *   TIER_3  → collapsed 2-rung (STUDIO_MGR → CD)   for CD-speed
 *
 * The capability matrix on each rung's RoleProfile.taskCapabilities
 * controls who can `canApprove` on `creative.internal_approval_requested`
 * at their level — see v1.2 §2.2. "Climbing the ladder" = the event
 * escalating up the role-profile.escalationPath until a role with
 * terminal approve authority (ECD for full Tier-1 chain) signs off.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * The 6 canonical rungs. Stored as STRING enums (not numeric) so a
 * collapsed chain can SKIP rungs without numeric arithmetic.
 */
export type ApprovalRung =
  | 'DESIGNER'        // Designer / Writer — the originator
  | 'AD'              // Art Director / Copywriter
  | 'STUDIO_MGR'      // Studio Manager / Head of Copy
  | 'ACD'             // Associate Creative Director
  | 'CD'              // Creative Director
  | 'ECD';            // Executive Creative Director (terminal)

/**
 * Ordered ladder for full-depth (TIER_1) traversal.
 */
export const FULL_LADDER: ApprovalRung[] = [
  'DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD',
];

/**
 * Resolve the ladder a given tier walks. Configurable per brand in
 * engine_config (deferred to 6.D.2); for now hard-coded.
 */
export const LADDER_BY_TIER: Record<string, ApprovalRung[]> = {
  TIER_1: ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD'],
  TIER_2: ['DESIGNER', 'ACD', 'CD', 'ECD'],
  TIER_3: ['STUDIO_MGR', 'CD'],
};

/**
 * One step in the chain history. Append-only; never edit a prior entry
 * (the rejection-loop pattern only reads as such when each pass is
 * preserved).
 */
export interface ApprovalRungEvent {
  /** Auto-incrementing index (1, 2, 3, …) within the chain. Used to
   *  reconstruct the full traversal for cycle-time analytics. */
  sequenceNumber: number;

  rung: ApprovalRung;

  /** What happened at this rung. `INIT` is the implicit DELIVERED →
   *  ladder-opens entry; `ADVANCE` and `REJECT` are explicit actor
   *  events. `GRANTED` is the terminal-rung approve. */
  action: 'INIT' | 'ADVANCE' | 'REJECT' | 'GRANTED';

  actorUserId: string;
  actorRoleProfileId?: string;
  occurredAt: Timestamp | string;

  /** Required for REJECT. Free-form structured notes — keep them
   *  parseable (e.g. JSON-ish with reason codes) so the watcher can
   *  pattern-match common failure modes. */
  notes?: string;
}

/**
 * The live approval chain on an IWO. Initialized when the IWO
 * transitions IN_PROGRESS → DELIVERED. Terminal state is when
 * `currentRung === ladder[ladder.length - 1]` AND the last history
 * entry has `action === 'GRANTED'`.
 */
export interface ApprovalChain {
  /** The full ladder this IWO walks — copied from LADDER_BY_TIER at
   *  init time so a later engine_config change doesn't retroactively
   *  rewrite in-flight chains. */
  ladder: ApprovalRung[];

  /** Position in the ladder. Equal to ladder[0] at INIT; advances on
   *  ADVANCE; resets to ladder[0] on REJECT (with a sequenceNumber
   *  bump so the rejection loop is preserved). */
  currentRung: ApprovalRung;

  /** Append-only — see ApprovalRungEvent docs. */
  history: ApprovalRungEvent[];

  /** True after InternalApprovalGranted fires. Read by
   *  acceptInternalRequestRevision as the gate. */
  complete: boolean;

  /** Snapshot of the tier the ladder was opened with — copied from
   *  IWO.tier for traceability when the IWO's tier later changes. */
  tierAtOpen?: string;

  initializedAt: Timestamp | string;
  completedAt?: Timestamp | string;
}

// ============================================
// Pure helpers (no Firestore dependencies — safe to share with FE)
// ============================================

/** True iff `rung` is the last entry in `ladder`. */
export function isTerminalRung(ladder: ApprovalRung[], rung: ApprovalRung): boolean {
  return ladder.length > 0 && ladder[ladder.length - 1] === rung;
}

/** The rung after `rung` in `ladder`, or null if terminal / not in ladder. */
export function nextRung(ladder: ApprovalRung[], rung: ApprovalRung): ApprovalRung | null {
  const idx = ladder.indexOf(rung);
  if (idx < 0 || idx === ladder.length - 1) return null;
  return ladder[idx + 1];
}

/** True iff the chain has reached its terminal rung AND been GRANTED. */
export function isApprovalComplete(chain: ApprovalChain | undefined | null): boolean {
  if (!chain) return false;
  return chain.complete === true;
}
