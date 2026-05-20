/**
 * designItemStatusDerivation — P7/F10 regression tests.
 *
 * These tests pin the derivation contract against the writers that
 * currently stamp the denormalized status fields. Each test simulates
 * the DesignItem shape AFTER a specific writer has run, and asserts the
 * derived value matches the flat field that writer would have stamped.
 *
 * If a writer starts stamping a different value, or a new state is added
 * without a matching timestamp, these tests break — on purpose. They're
 * the safety net for the later-slice readers-migration in P7.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveHandoverStatus,
  deriveFulfillmentStatus,
  type FulfillmentStatusInput,
  type HandoverStatusInput,
} from '../designItemStatusDerivation';

// The Timestamp sentinel shape is irrelevant — the derivation only checks
// truthiness. A plain object is a safe stand-in.
const TS = { _ts: true } as unknown as import('@/shared/types').Timestamp;

// ---------------------------------------------------------------------------
// handoverStatus
// ---------------------------------------------------------------------------

describe('deriveHandoverStatus — mirrors manufacturingOrderId', () => {
  it('returns "pending" when no MO is linked', () => {
    expect(deriveHandoverStatus({ manufacturingOrderId: undefined })).toBe('pending');
  });

  it('returns "pending" when the MO link was cleared (null)', () => {
    // Mirrors manufacturingOrderService.ts:764 — on MO delete we clear
    // both manufacturingOrderId and handoverStatus.
    expect(
      deriveHandoverStatus({ manufacturingOrderId: null as unknown as undefined }),
    ).toBe('pending');
  });

  it('returns "pending" for an empty-string MO id (defensive)', () => {
    expect(deriveHandoverStatus({ manufacturingOrderId: '' })).toBe('pending');
  });

  it('returns "handed-over" when an MO is linked', () => {
    // Mirrors handoverService.ts:421-426 — creating the MO and linking it
    // back stamps handoverStatus='handed-over' atomically.
    expect(deriveHandoverStatus({ manufacturingOrderId: 'mo-123' })).toBe('handed-over');
  });
});

// ---------------------------------------------------------------------------
// fulfillmentStatus — regression against each writer
// ---------------------------------------------------------------------------

describe('deriveFulfillmentStatus — regression against fulfillmentService writers', () => {
  it('defaults to "not_released" on a fresh DesignItem with no status set', () => {
    // Matches the fallback used by fulfillmentService.ts:83 when reading
    // for validation.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: undefined,
        fulfillment: undefined,
      }),
    ).toBe('not_released');
  });

  it('echoes pre-packing flat-field states (no timestamp to read)', () => {
    // These states are declared in the VALID_TRANSITIONS map in
    // fulfillmentService.ts but nothing sets a matching timestamp. The
    // flat field is the only source.
    for (const state of ['not_released', 'in_production', 'awaiting_receipt', 'packing'] as const) {
      expect(
        deriveFulfillmentStatus({ fulfillmentStatus: state, fulfillment: undefined }),
      ).toBe(state);
    }
  });

  it('returns "received" when moCloseoutService stamped fulfillment.receivedAt', () => {
    // Mirrors moCloseoutService.ts:423-432 — closeout sets
    // fulfillmentStatus='received' AND fulfillment.receivedAt together.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'received',
        fulfillment: { receivedAt: TS } as never,
      }),
    ).toBe('received');
  });

  it('returns "ready_for_dispatch" when markAsPacked stamped fulfillment.packedAt', () => {
    // Mirrors fulfillmentService.ts:86-109 — markAsPacked writes
    // fulfillmentStatus='ready_for_dispatch' + fulfillment.packedAt.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'ready_for_dispatch',
        fulfillment: { packedAt: TS },
      }),
    ).toBe('ready_for_dispatch');
  });

  it('returns "dispatched" when markAsDispatched stamped fulfillment.dispatchedAt', () => {
    // Mirrors fulfillmentService.ts:137-149.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'dispatched',
        fulfillment: {
          packedAt: TS,
          dispatchedAt: TS,
        },
      }),
    ).toBe('dispatched');
  });

  it('returns "delivered" when markAsDelivered stamped fulfillment.deliveredAt', () => {
    // Mirrors fulfillmentService.ts:172-182.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'delivered',
        fulfillment: {
          packedAt: TS,
          dispatchedAt: TS,
          deliveredAt: TS,
        },
      }),
    ).toBe('delivered');
  });

  it('returns "installed" when markAsInstalled stamped fulfillment.installedAt', () => {
    // Mirrors fulfillmentService.ts:205-216.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'installed',
        fulfillment: {
          packedAt: TS,
          dispatchedAt: TS,
          deliveredAt: TS,
          installedAt: TS,
        },
      }),
    ).toBe('installed');
  });

  it('returns "complete" when fulfillment.completedAt is set (P7 phase 3)', () => {
    // Post-phase-3 `markAsComplete` stamps `fulfillment.completedAt`
    // instead of the flat field. completedAt MUST win over installedAt
    // because 'complete' is the post-installation terminal state.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: undefined,
        fulfillment: {
          packedAt: TS,
          dispatchedAt: TS,
          deliveredAt: TS,
          installedAt: TS,
          completedAt: TS,
        },
      }),
    ).toBe('complete');
  });

  it('backward-compat: legacy docs with flat "complete" still derive complete', () => {
    // Pre-phase-3 rows stamped only the flat field. Derivation keeps
    // this fallback so no data migration is needed. Once legacy rows
    // age out (or a migration runs), this branch can be removed.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'complete',
        fulfillment: {
          packedAt: TS,
          dispatchedAt: TS,
          deliveredAt: TS,
          installedAt: TS,
        },
      }),
    ).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// Drift resilience — the whole point of deriving from timestamps
// ---------------------------------------------------------------------------

describe('deriveFulfillmentStatus — heals drift between flat field and timestamps', () => {
  it('promotes to the most-advanced timestamp even if the flat field lags', () => {
    // Scenario: a writer stamped installedAt but a concurrent update
    // overwrote the flat field with a stale value. Derivation trusts
    // the timestamp — that's the ground truth written by the service.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'dispatched',
        fulfillment: {
          packedAt: TS,
          dispatchedAt: TS,
          deliveredAt: TS,
          installedAt: TS,
        },
      }),
    ).toBe('installed');
  });

  it('ignores a flat-field value that was set without any timestamp', () => {
    // A legacy row was manually edited to 'delivered' without any
    // FulfillmentTracking. Derivation treats the missing timestamps as
    // dispositive — the item hasn't actually been delivered.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'delivered',
        fulfillment: undefined,
      }),
    ).toBe('delivered'); // No timestamp to anchor on — flat field is the
    // only source. This is the escape hatch for legacy data; the
    // "most-advanced wins" rule only fires when there IS a timestamp.
  });

  it('handles a partial FulfillmentTracking (timestamps missing for earlier stages)', () => {
    // A data-fix script stamped installedAt directly without backfilling
    // the intermediate timestamps. Derivation still returns the most
    // advanced state.
    expect(
      deriveFulfillmentStatus({
        fulfillmentStatus: 'installed',
        fulfillment: { installedAt: TS } as never,
      }),
    ).toBe('installed');
  });
});

// ---------------------------------------------------------------------------
// Type soundness — the derivation accepts Pick<> slices, not full items
// ---------------------------------------------------------------------------

describe('derivation helpers accept minimal structural inputs', () => {
  it('deriveHandoverStatus works on a bare {manufacturingOrderId} slice', () => {
    const minimal: HandoverStatusInput = { manufacturingOrderId: 'mo-abc' };
    expect(deriveHandoverStatus(minimal)).toBe('handed-over');
  });

  it('deriveFulfillmentStatus works on a bare {fulfillmentStatus, fulfillment} slice', () => {
    const minimal: FulfillmentStatusInput = {
      fulfillmentStatus: 'dispatched',
      fulfillment: { dispatchedAt: TS },
    };
    expect(deriveFulfillmentStatus(minimal)).toBe('dispatched');
  });

  it('deriveFulfillmentStatus works on a DTO with Record<string, any> fulfillment', () => {
    // Mirrors the shape used by `FulfillmentItem` in fulfillmentQueryService
    // — `fulfillment?: Record<string, any>`. The structural input type must
    // accept it without casts when passed as a typed value.
    const looseTracking: Record<string, unknown> = {
      deliveredAt: TS,
      extra: 'unknown field tolerated on a typed value',
    };
    const dto: FulfillmentStatusInput = {
      fulfillmentStatus: 'delivered',
      fulfillment: looseTracking,
    };
    expect(deriveFulfillmentStatus(dto)).toBe('delivered');
  });

  it('deriveHandoverStatus tolerates null manufacturingOrderId (post-MO-delete)', () => {
    const input: HandoverStatusInput = { manufacturingOrderId: null };
    expect(deriveHandoverStatus(input)).toBe('pending');
  });
});
