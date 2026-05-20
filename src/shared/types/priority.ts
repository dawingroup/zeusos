/**
 * Shared Part-Level Purchase Priority Types
 *
 * Standardized priority metadata that flows across modules:
 * Design Manager → Manufacturing BOM → Procurement
 *
 * Each module can override locally without affecting upstream.
 */

/** Module that last set a purchase priority rank */
export type PrioritySource = 'design' | 'manufacturing' | 'procurement';

/**
 * Part-level purchase priority metadata.
 * Used as a composite type for rich priority context (e.g., in hint services).
 */
export interface PartPurchasePriority {
  /** Manual rank (0-based, lower = higher priority / buy first). */
  rank: number;

  /** Module that last set this rank */
  source: PrioritySource;

  /** If overridden from upstream, stores the original upstream rank */
  upstreamRank?: number;

  /** Computed hint score (0-100). Advisory only, not used for sorting. */
  hintScore?: number;

  /** Human-readable hint signals (e.g., "Long lead time", "Out of stock") */
  hintSignals?: string[];
}
