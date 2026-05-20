/**
 * DesignItem status derivation — P7/F10.
 *
 * The data-model audit (F10) flagged that `DesignItem` carries four status
 * surfaces that drift: `currentStage`, `ragStatus`, `handoverStatus`,
 * `fulfillmentStatus`. Two of those four are redundant denormalizations of
 * ground-truth state that already lives on the item:
 *
 *   - `handoverStatus` is a mirror of whether `manufacturingOrderId` is
 *     set. Every writer that sets `handoverStatus: 'handed-over'` also
 *     sets `manufacturingOrderId`; every clear of the MO also clears the
 *     handover field. ('rejected' is declared in the type but no service
 *     has ever written it.)
 *
 *   - `fulfillmentStatus` is a mirror of the newest timestamp on
 *     `fulfillment: FulfillmentTracking`. Every service that advances the
 *     flat field — `markAsPacked`, `markAsDispatched`, `markAsDelivered`,
 *     `markAsInstalled` in `fulfillmentService.ts`, plus `moCloseoutService`
 *     stamping `receivedAt` — stamps the matching timestamp in the SAME
 *     `updateDoc` call. The only state that has no timestamp is `complete`
 *     (terminal), which we fall through to the flat field for.
 *
 * This file exposes the derivation so readers can start treating
 * `handoverStatus` / `fulfillmentStatus` as derived rather than stored.
 * Later slices (P7 phase 2+) will migrate readers, then drop the fields.
 *
 * Kept pure (no Firestore imports) so it's trivial to test and safe to
 * use in reducers, selectors, and render paths.
 */

import type { FulfillmentStatus } from '../types';

export type HandoverStatus = 'pending' | 'handed-over' | 'rejected';

/**
 * Minimal shape the handover derivation needs. Defined structurally so
 * DTOs that carry a looser type for `manufacturingOrderId` still fit.
 */
export interface HandoverStatusInput {
  manufacturingOrderId?: string | null;
}

/**
 * Shape the derivation reads off the nested fulfillment object. Only
 * the timestamp keys are declared; everything else on the real
 * `FulfillmentTracking` sub-object (and on the looser `Record<string, any>`
 * DTOs like `FulfillmentItem`) is tolerated.
 *
 * Typed as `unknown` because the derivation only checks truthiness — the
 * actual Timestamp shape is irrelevant here, and accepting `unknown` lets
 * both `Timestamp | undefined` (the strict type) and `any` (the loose
 * DTO) satisfy the shape.
 */
export interface FulfillmentTimestampsInput {
  // P7 phase 3 — `completedAt` was added so 'complete' is fully
  // derivable from timestamps and no flat-field fallback is needed.
  completedAt?: unknown;
  installedAt?: unknown;
  deliveredAt?: unknown;
  dispatchedAt?: unknown;
  packedAt?: unknown;
  packingStartedAt?: unknown;
  receivedAt?: unknown;
  // Deliberately no index signature. Strict typed values (FulfillmentTracking
  // and Record<string, any>) satisfy this shape structurally because their
  // declared keys are assignable to `unknown`. Object LITERALS written
  // inline do need to stick to these keys to pass excess-property
  // checks — which is fine: the derivation only reads these anyway.
}

/**
 * Minimal input the fulfillment derivation needs. Structural so any
 * object — strict `DesignItem`, DTO, plain fixture — that carries the
 * `fulfillmentStatus` flat field and a `fulfillment` sub-object fits
 * without casts at the call site.
 */
export interface FulfillmentStatusInput {
  fulfillmentStatus?: FulfillmentStatus;
  fulfillment?: FulfillmentTimestampsInput | null;
}

/**
 * Derive handover status from the canonical MO link.
 *
 * Writers today stamp this on DesignItem alongside `manufacturingOrderId`:
 *   - handoverService.ts:423, designToManufacturingService.ts:222,
 *     designItemToManufacturingOrderService.ts:339-341  → on MO create
 *   - manufacturingOrderService.ts:764                 → cleared on MO delete
 *
 * The field is therefore fully redundant with `manufacturingOrderId`.
 * 'rejected' is declared in the type but has never been written.
 */
export function deriveHandoverStatus(item: HandoverStatusInput): HandoverStatus {
  return item.manufacturingOrderId ? 'handed-over' : 'pending';
}

/**
 * Derive fulfillment status from the tracking sub-object.
 *
 * Contract — timestamps are ground truth, most-advanced wins:
 *
 *   fulfillment.completedAt   → 'complete'   (P7 phase 3, terminal)
 *   fulfillment.installedAt   → 'installed'
 *   fulfillment.deliveredAt   → 'delivered'
 *   fulfillment.dispatchedAt  → 'dispatched'
 *   fulfillment.packedAt      → 'ready_for_dispatch'
 *   fulfillment.packingStartedAt → 'packing'
 *   fulfillment.receivedAt    → 'received' (stamped by moCloseoutService)
 *
 * Backward compat: legacy docs written before the `completedAt`
 * timestamp was introduced stamped `fulfillmentStatus: 'complete'`
 * directly. The flat-field check remains as a fallback so those
 * rows still derive to 'complete' without a data migration.
 *
 * For pre-packing states (`not_released`, `in_production`, `awaiting_receipt`,
 * `packing`) no writer stamps a timestamp, so fall back to the flat field.
 * Undefined → `not_released` (the same default `fulfillmentService.ts`
 * uses when reading).
 */
export function deriveFulfillmentStatus(item: FulfillmentStatusInput): FulfillmentStatus {
  const f = item.fulfillment;

  // P7 phase 3 — completedAt is the new canonical signal for the
  // terminal state; it must be checked FIRST because 'complete' is
  // post-installation and the most-advanced wins.
  if (f?.completedAt) return 'complete';

  // Backward-compat: legacy flat-field 'complete' on docs that predate
  // the completedAt timestamp.
  if (item.fulfillmentStatus === 'complete') return 'complete';

  if (f?.installedAt) return 'installed';
  if (f?.deliveredAt) return 'delivered';
  if (f?.dispatchedAt) return 'dispatched';
  if (f?.packedAt) return 'ready_for_dispatch';
  if (f?.packingStartedAt) return 'packing';
  if (f?.receivedAt) return 'received';

  // No fulfillment timestamps yet — this item is upstream of packing.
  // The flat field still drives pre-packing states.
  return item.fulfillmentStatus ?? 'not_released';
}

// ============================================
// Construction status derivation
// ============================================

export type ConstructionDerivedStatus =
  | 'not-released'
  | 'mobilising'
  | 'in-progress'
  | 'inspecting'
  | 'handed-over'
  | 'completed';

/**
 * Minimum shape from a ConstructionOrder that `deriveConstructionStatus`
 * reads. Typed structurally so real `ConstructionOrder` docs, DTOs, and
 * plain fixtures all fit without casts.
 */
export interface ConstructionOrderDerivationInput {
  currentStage?: 'mobilisation' | 'execution' | 'qc' | 'handover';
  execution?: {
    siteHandoverAt?: unknown;
    kickoffAt?: unknown;
    inspectionPassedAt?: unknown;
    signoffAt?: unknown;
    completedAt?: unknown;
  };
}

export interface ConstructionStatusInput {
  constructionOrderId?: string | null;
}

/**
 * Derive the user-facing construction status for a DesignItem from its
 * linked ConstructionOrder. Mirrors `deriveFulfillmentStatus` — the CO
 * document is the source of truth; this helper is just the read model
 * for badges / lists.
 *
 * Most-advanced wins:
 *   execution.completedAt || execution.signoffAt → 'completed'
 *   currentStage === 'handover'                   → 'handed-over'
 *   execution.inspectionPassedAt || currentStage === 'qc' → 'inspecting'
 *   execution.kickoffAt || execution.siteHandoverAt
 *     || currentStage === 'execution'             → 'in-progress'
 *   currentStage === 'mobilisation'               → 'mobilising'
 *   no CO                                          → 'not-released'
 */
export function deriveConstructionStatus(
  item: ConstructionStatusInput,
  co?: ConstructionOrderDerivationInput | null,
): ConstructionDerivedStatus {
  if (!item.constructionOrderId || !co) return 'not-released';

  const e = co.execution || {};
  if (e.completedAt || e.signoffAt) return 'completed';
  if (co.currentStage === 'handover') return 'handed-over';
  if (e.inspectionPassedAt || co.currentStage === 'qc') return 'inspecting';
  if (e.kickoffAt || e.siteHandoverAt || co.currentStage === 'execution') {
    return 'in-progress';
  }
  if (co.currentStage === 'mobilisation') return 'mobilising';
  return 'not-released';
}
