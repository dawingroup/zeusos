/**
 * Pure rate-card versioning logic — used by both the Cloud Function and
 * the in-browser admin preview ("if I activate v2 today, v1's
 * effective_to will be set to X").
 *
 * Activating v(N) for a given org:
 *   - precondition: the candidate is DRAFT
 *   - precondition: `effectiveFrom` is a future-or-today date
 *   - effect: candidate → ACTIVE; prior ACTIVE for same org → RETIRED with
 *     `effectiveTo = candidate.effectiveFrom - 1 day`
 *
 * Spec §4.3 enforces UNIQUE(org_id, version); the next-version helper
 * here is the source of truth for the value `createRateCardVersion`
 * stamps onto new drafts.
 */

import type { RateCard, RateCardStatus } from '../types/rate-card.types';

export class RateCardError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'RateCardError';
  }
}

export function nextVersion(existing: ReadonlyArray<Pick<RateCard, 'version'>>): number {
  if (!existing.length) return 1;
  return Math.max(...existing.map(c => c.version)) + 1;
}

export function assertCanActivate(card: Pick<RateCard, 'status'>): void {
  if (card.status !== 'DRAFT') {
    throw new RateCardError('NOT_DRAFT', `Only DRAFT rate cards can be activated (got ${card.status}).`);
  }
}

export function assertCanRetire(card: Pick<RateCard, 'status'>): void {
  if (card.status !== 'ACTIVE') {
    throw new RateCardError('NOT_ACTIVE', `Only ACTIVE rate cards can be retired (got ${card.status}).`);
  }
}

/** Compute the auto-retire `effectiveTo` for the *prior* ACTIVE card when
 *  a new card activates with `nextEffectiveFrom`. Per task spec:
 *  "auto-retires prior ACTIVE for same org (effective_to set to one day
 *  before new effective_from)". */
export function autoRetireEffectiveTo(nextEffectiveFrom: Date): Date {
  const out = new Date(nextEffectiveFrom);
  out.setUTCDate(out.getUTCDate() - 1);
  return out;
}

export interface ActivationPlan {
  toActivate: { id: string; nextStatus: RateCardStatus; effectiveFrom: Date };
  toRetire?: { id: string; nextStatus: RateCardStatus; effectiveTo: Date };
}

/** Pure decision: given a candidate draft, the current ACTIVE (if any),
 *  and the requested effectiveFrom, return the side-effects the CFn
 *  transaction should apply. */
export function planActivation(args: {
  candidate: Pick<RateCard, 'id' | 'status'>;
  currentActive?: Pick<RateCard, 'id' | 'status'>;
  effectiveFrom: Date;
}): ActivationPlan {
  assertCanActivate(args.candidate);
  const plan: ActivationPlan = {
    toActivate: { id: args.candidate.id, nextStatus: 'ACTIVE', effectiveFrom: args.effectiveFrom },
  };
  if (args.currentActive) {
    plan.toRetire = {
      id: args.currentActive.id,
      nextStatus: 'RETIRED',
      effectiveTo: autoRetireEffectiveTo(args.effectiveFrom),
    };
  }
  return plan;
}
