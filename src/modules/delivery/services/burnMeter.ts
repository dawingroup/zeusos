/**
 * Burn-meter — pure calculation for the subsidiary delivery workspace.
 *
 * Spec §6.1.1 + §11.2: the hard 100% block is enforced server-side by the
 * `postTimeEntry` / `postCostEntry` Cloud Functions. This module is the
 * UI-side mirror used for the burn bar and the red ≥90% banner. It is a
 * pure function so it can be tested without Firestore.
 *
 * Inputs come in minor units (UGX, KES, USD…); we return minor units too
 * so the caller controls currency formatting.
 */

export type BurnStatus = 'OK' | 'WARN' | 'BLOCKED';

export interface BurnMeter {
  /** Sum of all time + cost entry costs against the IWO, in minor units. */
  cumulativeMinor: number;
  /** IWO budget cap, in minor units. */
  budgetMinor: number;
  /** Cumulative ÷ budget × 100, rounded to one decimal. Capped at 100. */
  percentage: number;
  /** Currency-agnostic remaining headroom (may be 0 at the cap). Never negative. */
  remainingMinor: number;
  /**
   * OK     — under 90 %.
   * WARN   — ≥ 90 % and < 100 %. UI surfaces a red banner.
   * BLOCKED — at or beyond 100 %. Cloud Function rejects further posts;
   *           UI hides the entry forms.
   */
  status: BurnStatus;
}

export interface BurnInput {
  cumulativeMinor: number;
  budgetMinor: number;
}

const WARN_THRESHOLD_PCT = 90;
const BLOCK_THRESHOLD_PCT = 100;

export function computeBurnMeter({ cumulativeMinor, budgetMinor }: BurnInput): BurnMeter {
  if (!Number.isFinite(budgetMinor) || budgetMinor <= 0) {
    // Degenerate input — surface as BLOCKED so the UI cannot allow posts.
    return {
      cumulativeMinor: Math.max(0, cumulativeMinor),
      budgetMinor: 0,
      percentage: 0,
      remainingMinor: 0,
      status: 'BLOCKED',
    };
  }
  const safeCum = Math.max(0, cumulativeMinor);
  const rawPct = (safeCum / budgetMinor) * 100;
  const pct = Math.min(100, Math.round(rawPct * 10) / 10);
  const remainingMinor = Math.max(0, budgetMinor - safeCum);

  let status: BurnStatus;
  if (rawPct >= BLOCK_THRESHOLD_PCT) status = 'BLOCKED';
  else if (rawPct >= WARN_THRESHOLD_PCT) status = 'WARN';
  else status = 'OK';

  return {
    cumulativeMinor: safeCum,
    budgetMinor,
    percentage: pct,
    remainingMinor,
    status,
  };
}

/**
 * Roll up an array of mixed time+cost entries into a single cumulative
 * value. Used by the workspace page when the IWO's stored
 * `cumulativeCostMinor` is stale (rare; Cloud Functions write it
 * transactionally) or for offline preview before a post.
 */
export interface SummableEntry {
  /** TimeEntry uses `costMinor`; CostEntry uses `amountMinor`. The caller
   *  normalises both into this single field before passing in. */
  amountMinor: number;
}

export function sumEntries(entries: readonly SummableEntry[]): number {
  return entries.reduce((acc, e) => acc + Math.max(0, e.amountMinor || 0), 0);
}
