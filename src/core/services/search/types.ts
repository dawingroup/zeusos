/**
 * Global Search V2 — shared type definitions
 */

import type { ModuleId } from '@/integration/constants/modules.constants';

/**
 * Normalized record stored in the in-memory index. Each Firestore doc is
 * transformed into this shape on snapshot. Keep it flat so Fuse.js can
 * index it without descending into nested objects.
 */
export interface IndexedRecord {
  /** Firestore doc id. */
  id: string;
  /** SearchConfig.type — drives ranking and card resolution. */
  type: string;
  /** Module the record belongs to. */
  module: ModuleId | string;
  /** Subsidiary the record was attached under (used for teardown bookkeeping). */
  subsidiaryId: string;
  /** Path to navigate to on selection. */
  path: string;
  /** Icon name (lucide). */
  icon: string;
  /** Card component key — usually equals `type`. */
  cardKind: string;
  /** Display title (e.g. customer name, order number). */
  title: string;
  /** Optional secondary line. */
  subtitle?: string;
  /** Optional sortable timestamps used for ranking tie-breaks. */
  updatedAt?: number;
  createdAt?: number;
  /** Whatever else the card needs to render (amount, status, etc.). Untyped on purpose. */
  data: Record<string, unknown>;
}

/** A single search hit, post-ranking. */
export interface SearchHit {
  record: IndexedRecord;
  /** Combined post-ranking score. Higher = better. */
  score: number;
  /** Per-key Fuse match metadata (used for highlight rendering). */
  matches?: ReadonlyArray<{ key?: string; value?: string; indices: ReadonlyArray<readonly [number, number]> }>;
}

/** Search mode — affects scope and code path. */
export type SearchMode = 'default' | 'deep-find';

/** Composite key the index uses to detect attach/detach cycles. */
export type AttachKey = `${string}:${string}`;

/** Input to the SearchIndexManager.search() method. */
export interface SearchOptions {
  mode?: SearchMode;
  limit?: number;
  /** Restrict to specific record types. */
  types?: string[];
}

/** Public readiness state of the index manager. */
export interface IndexReadiness {
  ready: boolean;
  /** Map of type → number of records currently indexed. */
  counts: Record<string, number>;
  /** Set of types whose initial snapshot has resolved (success or denied). */
  loaded: Set<string>;
  /** Total expected types to load before isReady() returns true. */
  expected: number;
}
