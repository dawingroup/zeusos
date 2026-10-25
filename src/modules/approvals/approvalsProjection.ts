/**
 * Pure projectors that normalize each ZeusOS approval source into the shared
 * ApprovalItem shape. No Firestore SDK imports — inputs are narrow structural
 * shapes (only the fields read), so this whole module is unit-testable with
 * plain objects and can be reused by the client hook, a server trigger, or a
 * backfill without dragging the SDK along.
 *
 * Each projector only emits an item when the source actually NEEDS a person
 * (a ladder open at a rung, a SOW pending approval, a draft change order, an
 * issued quote, a submitted invoice). Terminal / idle records project to
 * nothing.
 */

import type { ApprovalItem, ApprovalUrgency, ApprovalsScope } from './types';

// ── time + urgency helpers ────────────────────────────────────────────────

/** Firestore Timestamp-like, a Date, an ISO string, or epoch ms → epoch ms. */
export function toMillis(t: unknown): number | undefined {
  if (t == null) return undefined;
  if (typeof t === 'number') return Number.isFinite(t) ? t : undefined;
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'string') {
    const parsed = Date.parse(t);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  const maybe = t as { toMillis?: () => number; seconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return undefined;
}

const URGENCY_ORDER: ApprovalUrgency[] = ['low', 'medium', 'high', 'critical'];

export function urgencyRank(u: ApprovalUrgency): number {
  const idx = URGENCY_ORDER.indexOf(u);
  return idx < 0 ? 0 : idx;
}

/** The more urgent of two. */
export function maxUrgency(a: ApprovalUrgency, b: ApprovalUrgency): ApprovalUrgency {
  return urgencyRank(a) >= urgencyRank(b) ? a : b;
}

/** One step more urgent (saturates at critical). */
export function bumpUrgency(u: ApprovalUrgency): ApprovalUrgency {
  return URGENCY_ORDER[Math.min(urgencyRank(u) + 1, URGENCY_ORDER.length - 1)];
}

/**
 * Escalate urgency by age: older items climb the scale, but never below
 * the base the source itself asked for.
 */
export function urgencyForAge(days: number, base: ApprovalUrgency = 'low'): ApprovalUrgency {
  let byAge: ApprovalUrgency = 'low';
  if (days >= 14) byAge = 'critical';
  else if (days >= 7) byAge = 'high';
  else if (days >= 3) byAge = 'medium';
  return maxUrgency(byAge, base);
}

function daysBetween(fromMs: number | undefined, nowMs: number): number | undefined {
  if (fromMs == null) return undefined;
  return Math.max(0, Math.floor((nowMs - fromMs) / 86_400_000));
}

// ── narrow source input shapes (only the fields we read) ──────────────────

export interface IwoInput {
  id: string;
  code?: string;
  subsidiaryOrgId?: string;
  masterJobId?: string;
  state?: string;
  budgetMinor?: number;
  currency?: string;
  tier?: string;
  slaDueAt?: unknown;
  deliveredAt?: unknown;
  updatedAt?: unknown;
  issuedByUserId?: string;
  approvalChain?: {
    ladder?: string[];
    currentRung?: string;
    complete?: boolean;
    history?: Array<{ occurredAt?: unknown; action?: string; rung?: string }>;
  } | null;
}

export interface SowInput {
  id: string;
  code?: string;
  title?: string;
  clientId?: string;
  msaId?: string;
  status?: string;
  ceilingMinor?: number;
  currency?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export interface ChangeOrderInput {
  id: string;
  code?: string;
  sowId?: string;
  clientId?: string;
  msaId?: string;
  status?: string;
  deltaMinor?: number;
  currency?: string;
  reason?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuoteInput {
  id: string;
  code?: string;
  clientId?: string;
  sowId?: string;
  status?: string;
  clientTotalMinor?: number;
  currency?: string;
  issuedAt?: unknown;
  issuedByUserId?: string;
  createdBy?: string;
  updatedAt?: unknown;
}

export interface TalentInvoiceInput {
  id: string;
  talentProfileId?: string;
  masterJobId?: string;
  status?: string;
  amountMinor?: number;
  currency?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MediaSupplierInvoiceInput {
  id: string;
  supplierOrgId?: string;
  mediaPlanId?: string;
  masterJobId?: string;
  vehicleType?: string;
  status?: string;
  amountMinor?: number;
  currency?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── labels ────────────────────────────────────────────────────────────────

/** Human names for the ECD ladder rungs (v1.1 §7.1). */
export const RUNG_LABELS: Record<string, string> = {
  DESIGNER: 'Designer / Writer',
  AD: 'Art Director',
  STUDIO_MGR: 'Studio Manager',
  ACD: 'Associate Creative Director',
  CD: 'Creative Director',
  ECD: 'Executive Creative Director',
};

export function rungLabel(rung: string | undefined): string {
  if (!rung) return 'the ladder';
  return RUNG_LABELS[rung] ?? rung;
}

const ACTION_LABELS: Record<string, string> = {
  advance_approval_rung: 'Approve at this rung',
  accept_internally: 'Accept internally',
  approve_sow: 'Approve SOW',
  approve_change_order: 'Approve change order',
  awaiting_client_acceptance: 'Awaiting client acceptance',
  approve_talent_invoice: 'Approve talent invoice',
  approve_media_supplier_invoice: 'Approve media invoice',
};

export function humanizeAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

// ── projectors ────────────────────────────────────────────────────────────

/**
 * A DELIVERED IWO raises exactly one of two items:
 *  - the ECD ladder is open at a rung → `ecd_rung` (someone at that rung
 *    must advance or return it);
 *  - the ladder is complete, or the IWO predates the ladder → the AM must
 *    `acceptInternal` or request a revision → `iwo_internal_acceptance`.
 * A passed SLA lifts the urgency one step whatever the age.
 */
export function projectIwo(iwo: IwoInput, nowMs: number): ApprovalItem | null {
  if (iwo.state !== 'DELIVERED') return null;
  const chain = iwo.approvalChain ?? undefined;
  const ladderOpen = !!chain && chain.complete !== true && !!chain.currentRung;

  const history = chain?.history ?? [];
  const lastMoveMs = history.length ? toMillis(history[history.length - 1]?.occurredAt) : undefined;
  const raisedMs = lastMoveMs ?? toMillis(iwo.deliveredAt) ?? toMillis(iwo.updatedAt);
  const days = daysBetween(raisedMs, nowMs) ?? 0;
  const dueAtMs = toMillis(iwo.slaDueAt);
  const overdue = dueAtMs !== undefined && dueAtMs < nowMs;
  const ref = iwo.code ?? iwo.id;

  let urgency = urgencyForAge(days, 'medium');
  if (overdue) urgency = bumpUrgency(urgency);

  const base = {
    entity: { type: 'iwo' as const, id: iwo.id, ref: iwo.code, masterJobId: iwo.masterJobId },
    amountMinor: iwo.budgetMinor,
    currency: iwo.currency,
    requesterUserId: iwo.issuedByUserId,
    brandId: iwo.subsidiaryOrgId,
    dueAtMs,
    daysPending: days,
    updatedAtMs: raisedMs,
    decision: 'inline' as const,
    urgency,
  };

  if (ladderOpen) {
    const rung = chain!.currentRung!;
    return {
      ...base,
      id: `ecd:${iwo.id}`,
      kind: 'ecd_rung',
      title: `${ref} — awaiting ${rungLabel(rung)}`,
      requiredAction: 'advance_approval_rung',
      status: rung,
    };
  }

  return {
    ...base,
    id: `iwo-accept:${iwo.id}`,
    kind: 'iwo_internal_acceptance',
    title: `${ref} — delivered, awaiting internal acceptance`,
    requiredAction: 'accept_internally',
    status: 'DELIVERED',
  };
}

/** A SOW submitted for approval. */
export function projectSow(sow: SowInput, nowMs: number): ApprovalItem | null {
  if (sow.status !== 'PENDING_APPROVAL') return null;
  const raisedMs = toMillis(sow.updatedAt) ?? toMillis(sow.createdAt);
  const days = daysBetween(raisedMs, nowMs) ?? 0;
  const ref = sow.code ?? sow.id;
  return {
    id: `sow:${sow.id}`,
    kind: 'sow_approval',
    title: `SOW ${ref}${sow.title ? ` — ${sow.title}` : ''}`,
    requiredAction: 'approve_sow',
    urgency: urgencyForAge(days, 'medium'),
    status: sow.status,
    entity: { type: 'sow', id: sow.id, ref: sow.code, clientId: sow.clientId, msaId: sow.msaId },
    amountMinor: sow.ceilingMinor,
    currency: sow.currency,
    clientId: sow.clientId,
    daysPending: days,
    updatedAtMs: raisedMs,
    decision: 'inline',
  };
}

/**
 * A change order awaiting a decision. ZeusOS change orders have no
 * "submitted" state — a DRAFT is what approve / reject act on — so every
 * DRAFT surfaces. A de-scope (negative delta) is lower urgency than a
 * ceiling raise: nobody is waiting on money for it.
 */
export function projectChangeOrder(co: ChangeOrderInput, nowMs: number): ApprovalItem | null {
  if (co.status !== 'DRAFT') return null;
  const raisedMs = toMillis(co.updatedAt) ?? toMillis(co.createdAt);
  const days = daysBetween(raisedMs, nowMs) ?? 0;
  const ref = co.code ?? co.id;
  const raisesCeiling = (co.deltaMinor ?? 0) > 0;
  return {
    id: `co:${co.id}`,
    kind: 'change_order',
    title: `Change order ${ref}${co.reason ? ` — ${co.reason}` : ''}`,
    requiredAction: 'approve_change_order',
    urgency: urgencyForAge(days, raisesCeiling ? 'medium' : 'low'),
    status: co.status,
    entity: { type: 'changeOrder', id: co.id, ref: co.code, clientId: co.clientId, msaId: co.msaId, sowId: co.sowId },
    amountMinor: co.deltaMinor,
    currency: co.currency,
    requesterUserId: co.createdBy,
    clientId: co.clientId,
    daysPending: days,
    updatedAtMs: raisedMs,
    decision: 'inline',
  };
}

/**
 * A quote out with the client. Nobody inside Zeus decides it — it sits in
 * the inbox as a nudge (chase, don't approve), so it is `open_only`.
 */
export function projectQuote(q: QuoteInput, nowMs: number): ApprovalItem | null {
  if (q.status !== 'ISSUED') return null;
  const raisedMs = toMillis(q.issuedAt) ?? toMillis(q.updatedAt);
  const days = daysBetween(raisedMs, nowMs) ?? 0;
  const ref = q.code ?? q.id;
  return {
    id: `quote:${q.id}`,
    kind: 'quote_awaiting_client',
    title: `Quote ${ref} — issued, awaiting client acceptance`,
    requiredAction: 'awaiting_client_acceptance',
    urgency: urgencyForAge(days, 'low'),
    status: q.status,
    entity: { type: 'quote', id: q.id, ref: q.code, clientId: q.clientId, sowId: q.sowId },
    amountMinor: q.clientTotalMinor,
    currency: q.currency,
    requesterUserId: q.issuedByUserId ?? q.createdBy,
    clientId: q.clientId,
    daysPending: days,
    updatedAtMs: raisedMs,
    decision: 'open_only',
  };
}

/** A freelancer invoice awaiting AM approval. Money owed to a person: high floor. */
export function projectTalentInvoice(inv: TalentInvoiceInput, nowMs: number): ApprovalItem | null {
  if (inv.status !== 'SUBMITTED') return null;
  const raisedMs = toMillis(inv.createdAt) ?? toMillis(inv.updatedAt);
  const days = daysBetween(raisedMs, nowMs) ?? 0;
  return {
    id: `talent-inv:${inv.id}`,
    kind: 'talent_invoice',
    title: `Talent invoice ${inv.id}`,
    requiredAction: 'approve_talent_invoice',
    urgency: urgencyForAge(days, 'medium'),
    status: inv.status,
    entity: { type: 'talentInvoice', id: inv.id, masterJobId: inv.masterJobId },
    amountMinor: inv.amountMinor,
    currency: inv.currency,
    requesterUserId: inv.createdBy,
    daysPending: days,
    updatedAtMs: raisedMs,
    decision: 'inline',
  };
}

/** A media-house invoice awaiting AM approval. */
export function projectMediaSupplierInvoice(inv: MediaSupplierInvoiceInput, nowMs: number): ApprovalItem | null {
  if (inv.status !== 'SUBMITTED') return null;
  const raisedMs = toMillis(inv.createdAt) ?? toMillis(inv.updatedAt);
  const days = daysBetween(raisedMs, nowMs) ?? 0;
  return {
    id: `media-inv:${inv.id}`,
    kind: 'media_supplier_invoice',
    title: `Media invoice ${inv.id}${inv.vehicleType ? ` — ${inv.vehicleType}` : ''}`,
    requiredAction: 'approve_media_supplier_invoice',
    urgency: urgencyForAge(days, 'medium'),
    status: inv.status,
    entity: { type: 'mediaSupplierInvoice', id: inv.id, mediaPlanId: inv.mediaPlanId, masterJobId: inv.masterJobId },
    amountMinor: inv.amountMinor,
    currency: inv.currency,
    requesterUserId: inv.createdBy,
    daysPending: days,
    updatedAtMs: raisedMs,
    decision: 'inline',
  };
}

// ── aggregation ───────────────────────────────────────────────────────────

export interface ApprovalsInboxSources {
  iwos?: IwoInput[];
  sows?: SowInput[];
  changeOrders?: ChangeOrderInput[];
  quotes?: QuoteInput[];
  talentInvoices?: TalentInvoiceInput[];
  mediaSupplierInvoices?: MediaSupplierInvoiceInput[];
}

/**
 * Build the full inbox from every provided source and sort it so the most
 * urgent, longest-waiting items surface first. `nowMs` is injected (not
 * read from the clock) so the result is deterministic and testable.
 */
export function buildApprovalsInbox(sources: ApprovalsInboxSources, nowMs: number): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  const push = (item: ApprovalItem | null) => {
    if (item) items.push(item);
  };
  for (const iwo of sources.iwos ?? []) push(projectIwo(iwo, nowMs));
  for (const sow of sources.sows ?? []) push(projectSow(sow, nowMs));
  for (const co of sources.changeOrders ?? []) push(projectChangeOrder(co, nowMs));
  for (const q of sources.quotes ?? []) push(projectQuote(q, nowMs));
  for (const inv of sources.talentInvoices ?? []) push(projectTalentInvoice(inv, nowMs));
  for (const inv of sources.mediaSupplierInvoices ?? []) push(projectMediaSupplierInvoice(inv, nowMs));
  return sortApprovalItems(items, nowMs);
}

/** Most urgent first; then overdue-SLA before not; then longest-waiting. */
export function sortApprovalItems(items: ApprovalItem[], nowMs: number): ApprovalItem[] {
  const overdue = (i: ApprovalItem) => (i.dueAtMs !== undefined && i.dueAtMs < nowMs ? 1 : 0);
  return [...items].sort((a, b) => {
    const byUrgency = urgencyRank(b.urgency) - urgencyRank(a.urgency);
    if (byUrgency !== 0) return byUrgency;
    const byOverdue = overdue(b) - overdue(a);
    if (byOverdue !== 0) return byOverdue;
    return (b.daysPending ?? 0) - (a.daysPending ?? 0);
  });
}

/**
 * Narrow an inbox to what a scope may see. The feeds already open only the
 * queries a scope is allowed (rules deny the rest), so this is the second
 * line: a brand sees its own IWO rows and nothing commercial.
 */
export function filterByScope(items: ApprovalItem[], scope: ApprovalsScope): ApprovalItem[] {
  if (scope.kind === 'parent') return items;
  if (scope.kind === 'brand') {
    return items.filter(
      (i) => (i.kind === 'ecd_rung' || i.kind === 'iwo_internal_acceptance') && i.brandId === scope.orgId,
    );
  }
  return [];
}
