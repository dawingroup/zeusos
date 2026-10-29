/**
 * Unified approvals read model — port stream F (from DawinOS issue #1039).
 *
 * Every approval step in ZeusOS keeps its own state in its own collection
 * and field: the ECD ladder on `internal_work_orders.approvalChain`, AM
 * internal acceptance on IWO `state`, SOW activation on `sows.status`,
 * change orders on `change_orders.status`, client acceptance on
 * `quotes.status`, and supplier spend on `talent_invoices` /
 * `media_supplier_invoices`. There was no one place a person could see
 * "what is waiting on me, and how urgently". This module defines ONE
 * normalized item those sources project into, so a single surface
 * (`/approvals`) can list them most-urgent-first and act on them with the
 * callables that already exist.
 *
 * The projection is deliberately pure and source-agnostic — see
 * `approvalsProjection.ts`. Times are plain epoch ms (not Firestore
 * Timestamps) so the core stays free of the SDK and is unit-testable.
 */

import type { RecordEntityType } from '@/shared/navigation';

/** Which approval control an item came from. */
export type ApprovalKind =
  /** IWO is DELIVERED and its ECD ladder is open at a rung (v1.1 §7). */
  | 'ecd_rung'
  /** IWO is DELIVERED with its ladder complete (or absent, pre-6.D) and awaits AM `acceptInternal`. */
  | 'iwo_internal_acceptance'
  /** SOW submitted for approval (`PENDING_APPROVAL` → `approveSow`). */
  | 'sow_approval'
  /** Change order awaiting approval (`DRAFT` → approve / reject). */
  | 'change_order'
  /** Quote issued to the client and awaiting their acceptance — a nudge, not a decision. */
  | 'quote_awaiting_client'
  /** Freelancer invoice awaiting AM approval (`SUBMITTED`). */
  | 'talent_invoice'
  /** Media-house invoice awaiting AM approval (`SUBMITTED`). */
  | 'media_supplier_invoice';

/** Shared urgency scale. */
export type ApprovalUrgency = 'low' | 'medium' | 'high' | 'critical';

/**
 * Entity types a row can point at. The shared record-route registry has
 * no entry for the two supplier-invoice collections (they have list pages
 * only), so they are named here and `approvalRowHref` handles them.
 */
export type ApprovalEntityType = RecordEntityType | 'talentInvoice' | 'mediaSupplierInvoice';

/** A normalized, cross-source approval item. */
export interface ApprovalItem {
  /**
   * Stable composite key, unique across every source, e.g. `ecd:<iwoId>`,
   * `iwo-accept:<iwoId>`, `sow:<sowId>`, `co:<coId>`, `quote:<quoteId>`,
   * `talent-inv:<id>`, `media-inv:<id>`. Lets the UI key rows and a future
   * projection collection use it as the document id.
   */
  id: string;
  kind: ApprovalKind;
  /** One-line human summary, e.g. "IWO-ZTA-DIAGEO-014 — awaiting Creative Director". */
  title: string;
  /** What the person needs to do, e.g. 'advance_approval_rung', 'approve_sow'. */
  requiredAction: string;
  urgency: ApprovalUrgency;
  /** The source record's own status / rung string (for display and filtering). */
  status: string;
  /** The underlying record this item links to and acts on. */
  entity: {
    type: ApprovalEntityType;
    id: string;
    /** Human reference (IWO code, SOW code, CO code, …) when available. */
    ref?: string;
    /** Owning client — needed by the nested commercial routes. */
    clientId?: string;
    /** Owning MSA — needed by the SOW / change-order routes. */
    msaId?: string;
    /** Owning SOW — needed by the change-order route. */
    sowId?: string;
    /** Owning media plan — where a media-supplier invoice is worked from. */
    mediaPlanId?: string;
    /** Owning engagement, when the record carries one. */
    masterJobId?: string;
  };
  /** Money the decision commits, in minor units, when the record carries one. */
  amountMinor?: number;
  currency?: string;
  /**
   * Who raised the record. The one person who must never approve it
   * (ADR-0002 — the raiser is not the approver). Undefined when the source
   * does not record a raiser (SOWs today).
   */
  requesterUserId?: string;
  /** Serving brand, when the record is brand-scoped (IWOs). */
  brandId?: string;
  clientId?: string;
  /** SLA deadline, epoch ms, when the record carries one (IWO `slaDueAt`). */
  dueAtMs?: number;
  /** Days the item has been waiting, when known. */
  daysPending?: number;
  /** Epoch ms the item was raised / last moved, for stable sorting. */
  updatedAtMs?: number;
  /**
   * `inline` — a callable exists and the inbox offers Approve / Reject on
   * the row. `open_only` — the decision is someone else's (the client) or
   * is taken on the record's own page; the row only links out.
   */
  decision: 'inline' | 'open_only';
}

/** Who the inbox is for. Resolved from the signed-in user — see `scope.ts`. */
export type ApprovalsScope =
  /** Parent-org (Account Management) principal: every queue. */
  | { kind: 'parent' }
  /** A brand's own staff: that brand's IWO rows only (ECD rungs + awaiting acceptance). */
  | { kind: 'brand'; orgId: string }
  /** No org scope — nothing to show. */
  | { kind: 'none' };
