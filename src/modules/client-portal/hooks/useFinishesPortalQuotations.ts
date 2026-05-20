/**
 * useFinishesPortalQuotations — feeds the portal Quotations screen.
 *
 * In the Dawin Finishes model, a "Quotation" in the client's eyes
 * unifies three things:
 *   - **The base contract** — the SalesOrder itself, surfaced as a
 *     synthetic "sealed" quote so the client sees the original
 *     contract value in the same list as variations.
 *   - **Pre-contract quotes** — `clientQuotes` rows tied to the same
 *     DesignProject. These are the quotes Dawin sent before the
 *     contract was signed.
 *   - **Variations** — `changeOrders` for the linked SO. Each one
 *     reads as a re-quote (Q-019 v2 etc.).
 *
 * All three are normalised into `QuotationItem[]` and bucketed by
 * status so the page can render a single tab strip / list.
 */

import { useEffect, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type { DesignProject } from '@/modules/design-manager/types';
import type {
  SalesOrder,
  ChangeOrder,
} from '@/modules/sales-orders/types';
import type {
  ClientQuote,
  ClientQuoteStatus,
} from '@/modules/design-manager/types/clientPortal';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
  getClientQuotesForProject,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export type QuotationKind = 'client_quote' | 'change_order' | 'base_contract';

export type QuotationBucket = 'open' | 'sealed' | 'superseded' | 'draft';

export interface QuotationItem {
  id: string;
  kind: QuotationKind;
  raw: ClientQuote | ChangeOrder | SalesOrder;

  /** "Q-019 v2", "QT-2026-001", "SO-VELA-2026-014" */
  number: string;
  /** Short label, e.g. "Stone variation — Calacatta upgrade" */
  title: string;
  /** Subtitle / category hint */
  sub?: string;
  /** Phase label — Mobilisation / Construction / etc. */
  phase: string;

  issuedAt?: Date;
  /** Open: due date if known; Sealed: sealed date. */
  signpost?: Date;

  total: number;
  currency: string;

  bucket: QuotationBucket;
  /** UI status text rendered in the chip */
  statusLabel: string;
  /** Whether the row is highlighted (signal red) */
  signal: boolean;
}

export interface QuotationCounts {
  open: number;
  sealed: number;
  superseded: number;
  draft: number;
}

export interface QuotationKpis {
  /** Sum of all sealed quotes (incl. base contract). */
  sealedValue: number;
  /** Sum of all open quotes. */
  openValue: number;
  /** SUM(change order priceImpact) / base SO total — as a percent. */
  variationPct: number;
  /** Convenience: total open count. */
  openCount: number;
}

export interface PortalQuotationsData {
  project: DesignProject;
  salesOrder: SalesOrder;
  items: QuotationItem[];
  counts: QuotationCounts;
  kpis: QuotationKpis;
}

interface State {
  data: PortalQuotationsData | null;
  loading: boolean;
  error: Error | null;
}

export function useFinishesPortalQuotations(code: string | undefined): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    (async () => {
      try {
        const project = await getPortalProjectByCode(code);
        if (!project) throw new Error(`Project ${code} not found`);

        assertProjectAccess(user, project);

        let so: SalesOrder | null = null;
        if (project.linkedSalesOrderId) {
          so = await getSalesOrderById(project.linkedSalesOrderId);
        }
        if (!so) so = await getSalesOrderForProject(project.id);
        if (!so) throw new Error('No sales order linked to this project');

        const [clientQuotes, changeOrders] = await Promise.all([
          getClientQuotesForProject(project.id),
          fetchChangeOrdersForSO(so.id),
        ]);

        const items: QuotationItem[] = [
          mapSalesOrder(so),
          ...clientQuotes.map((q) => mapClientQuote(q)),
          ...changeOrders.map((c) => mapChangeOrder(c, so!)),
        ];

        items.sort(quotationSorter);

        const counts: QuotationCounts = {
          open: items.filter((i) => i.bucket === 'open').length,
          sealed: items.filter((i) => i.bucket === 'sealed').length,
          superseded: items.filter((i) => i.bucket === 'superseded').length,
          draft: items.filter((i) => i.bucket === 'draft').length,
        };

        const sealedValue = items
          .filter((i) => i.bucket === 'sealed')
          .reduce((sum, i) => sum + i.total, 0);
        const openValue = items
          .filter((i) => i.bucket === 'open')
          .reduce((sum, i) => sum + i.total, 0);
        const variationTotal = changeOrders
          .filter((c) => c.status === 'approved')
          .reduce((sum, c) => sum + (c.priceImpact ?? 0), 0);
        const variationPct = so.originalQuoteAmount
          ? Math.round((variationTotal / so.originalQuoteAmount) * 1000) / 10
          : 0;

        const kpis: QuotationKpis = {
          sealedValue,
          openValue,
          variationPct,
          openCount: counts.open,
        };

        if (cancelled) return;
        setState({
          data: { project, salesOrder: so, items, counts, kpis },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err as Error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, user?.uid]);

  return state;
}

async function fetchChangeOrdersForSO(salesOrderId: string): Promise<ChangeOrder[]> {
  try {
    const snap = await getDocs(query(
      collection(db, 'changeOrders'),
      where('salesOrderId', '==', salesOrderId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChangeOrder);
  } catch {
    return [];
  }
}

function mapSalesOrder(so: SalesOrder): QuotationItem {
  return {
    id: `so-${so.id}`,
    kind: 'base_contract',
    raw: so,
    number: so.orderNumber,
    title: 'Base contract',
    sub: so.title || so.description,
    phase: 'Mobilisation',
    issuedAt: tsToDate(so.scopeFrozenAt) ?? tsToDate(so.createdAt),
    signpost: tsToDate(so.scopeFrozenAt) ?? tsToDate(so.createdAt),
    total: so.originalQuoteAmount,
    currency: so.currency,
    bucket: 'sealed',
    statusLabel: 'Sealed',
    signal: false,
  };
}

function mapClientQuote(q: ClientQuote): QuotationItem {
  return {
    id: q.id,
    kind: 'client_quote',
    raw: q,
    number: q.quoteNumber,
    title: q.title,
    sub: q.description ?? `Original quote v${q.version}`,
    phase: phaseForQuote(q),
    issuedAt: tsToDate(q.sentAt) ?? tsToDate(q.createdAt),
    signpost: tsToDate(q.validUntil) ?? tsToDate(q.respondedAt),
    total: q.total,
    currency: q.currency,
    bucket: bucketForQuote(q.status),
    statusLabel: labelForQuote(q.status),
    signal: q.status === 'sent' || q.status === 'viewed' || q.status === 'revision',
  };
}

function mapChangeOrder(c: ChangeOrder, so: SalesOrder): QuotationItem {
  // For variations we surface the priceImpact, which is what clients
  // care about (the delta against contract). The newOrderTotal is
  // shown in the detail view.
  return {
    id: c.id,
    kind: 'change_order',
    raw: c,
    number: c.changeOrderNumber,
    title: c.title,
    sub: c.description?.slice(0, 100) || c.reason?.slice(0, 100),
    phase: phaseForChangeOrder(c),
    issuedAt: tsToDate(c.submittedToClientAt) ?? tsToDate(c.createdAt),
    signpost: c.status === 'pending_client'
      ? tsToDate(c.submittedToClientAt)
      : tsToDate(c.clientApprovedAt) ?? tsToDate(c.rejectedAt),
    total: c.priceImpact ?? (c.newOrderTotal - so.originalQuoteAmount),
    currency: so.currency,
    bucket: bucketForChangeOrder(c.status),
    statusLabel: labelForChangeOrder(c.status),
    signal: c.status === 'pending_client',
  };
}

function bucketForQuote(s: ClientQuoteStatus): QuotationBucket {
  if (s === 'sent' || s === 'viewed' || s === 'revision') return 'open';
  if (s === 'approved') return 'sealed';
  if (s === 'rejected' || s === 'expired') return 'superseded';
  return 'draft';
}

function bucketForChangeOrder(s: ChangeOrder['status']): QuotationBucket {
  if (s === 'pending_client' || s === 'pending_internal') return 'open';
  if (s === 'approved') return 'sealed';
  if (s === 'rejected' || s === 'withdrawn') return 'superseded';
  return 'draft';
}

function labelForQuote(s: ClientQuoteStatus): string {
  switch (s) {
    case 'sent': return 'Awaiting you';
    case 'viewed': return 'Awaiting you';
    case 'revision': return 'Revision';
    case 'approved': return 'Sealed';
    case 'rejected': return 'Rejected';
    case 'expired': return 'Expired';
    case 'draft': return 'Draft';
  }
}

function labelForChangeOrder(s: ChangeOrder['status']): string {
  switch (s) {
    case 'pending_client': return 'Awaiting you';
    case 'pending_internal': return 'Internal review';
    case 'approved': return 'Sealed';
    case 'rejected': return 'Rejected';
    case 'withdrawn': return 'Withdrawn';
    case 'draft': return 'Draft';
  }
}

function phaseForQuote(_q: ClientQuote): string {
  return 'Pre-contract';
}

function phaseForChangeOrder(c: ChangeOrder): string {
  if (c.isPostScopeFreeze) return 'Construction';
  if (c.type === 'specification_change') return 'Procurement';
  return 'Variation';
}

function quotationSorter(a: QuotationItem, b: QuotationItem): number {
  // Order: open (signal first) → sealed (most recent first) → draft → superseded
  const bucketOrder: Record<QuotationBucket, number> = {
    open: 0, sealed: 1, draft: 2, superseded: 3,
  };
  if (a.bucket !== b.bucket) return bucketOrder[a.bucket] - bucketOrder[b.bucket];
  const aMs = a.signpost?.getTime() ?? a.issuedAt?.getTime() ?? 0;
  const bMs = b.signpost?.getTime() ?? b.issuedAt?.getTime() ?? 0;
  if (a.bucket === 'open') return aMs - bMs; // soonest due first
  return bMs - aMs;                            // most recent first
}

function tsToDate(t: Timestamp | undefined): Date | undefined {
  if (!t) return undefined;
  if (typeof (t as Timestamp).toDate !== 'function') return undefined;
  return (t as Timestamp).toDate();
}
