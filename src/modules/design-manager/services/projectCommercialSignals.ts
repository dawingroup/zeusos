/**
 * Derives commercial / quote signals for Design Manager project lists (filters + badges).
 * Read-time only — no Firestore writes.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { SO_COLLECTION } from '@/modules/sales-orders/constants';
import type { ClientQuote, ClientQuoteLineItem } from '../types/clientPortal';
import type { DesignProject } from '../types';

const CLIENT_QUOTES_COLLECTION = 'clientQuotes';

export type QuoteCommercialSignal =
  | 'none'
  | 'draft'
  | 'with_client'
  | 'declined'
  | 'partial_lines'
  | 'full_approval';

function tsMs(ts: { toMillis?: () => number; seconds?: number } | null | undefined): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

/**
 * Classify a single quote for UI filters and row badges, using the most recent
 * `ClientQuote` for the project (caller picks latest by createdAt).
 */
export function deriveQuoteCommercialSignal(quote: ClientQuote | null): QuoteCommercialSignal {
  if (!quote) return 'none';

  switch (quote.status) {
    case 'draft':
      return 'draft';
    case 'sent':
    case 'viewed':
      return 'with_client';
    case 'revision':
      return 'with_client';
    case 'rejected':
    case 'expired':
      return 'declined';
    case 'approved':
      return deriveApprovedQuoteSignal(quote.lineItems);
    default:
      return 'with_client';
  }
}

function deriveApprovedQuoteSignal(lineItems: ClientQuoteLineItem[]): QuoteCommercialSignal {
  if (lineItems.length === 0) return 'full_approval';
  const hasGranular = lineItems.some((li) => li.approvalStatus);
  if (!hasGranular) return 'full_approval';
  const approvedN = lineItems.filter((li) => li.approvalStatus === 'approved').length;
  if (approvedN === lineItems.length) return 'full_approval';
  if (approvedN > 0) return 'partial_lines';
  return 'with_client';
}

export const QUOTE_SIGNAL_LABEL: Record<QuoteCommercialSignal, string> = {
  none: 'No quote',
  draft: 'Quote draft',
  with_client: 'With client',
  declined: 'Quote declined / expired',
  partial_lines: 'Part-approved lines',
  full_approval: 'Quote approved',
};

export const QUOTE_SIGNAL_BADGE_CLASS: Record<QuoteCommercialSignal, string> = {
  none: 'bg-slate-100 text-slate-600',
  draft: 'bg-amber-50 text-amber-800',
  with_client: 'bg-sky-50 text-sky-800',
  declined: 'bg-rose-50 text-rose-800',
  partial_lines: 'bg-violet-50 text-violet-800',
  full_approval: 'bg-emerald-50 text-emerald-800',
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Fetches all client quotes for the given project IDs (batched `in` queries),
 * then picks the **latest** quote per project by `createdAt` descending.
 */
export async function fetchLatestClientQuoteByProjectId(
  projectIds: string[],
): Promise<Map<string, ClientQuote | null>> {
  const out = new Map<string, ClientQuote | null>();
  for (const id of projectIds) {
    out.set(id, null);
  }
  if (projectIds.length === 0) return out;

  for (const part of chunk(projectIds, 10)) {
    if (part.length === 0) continue;
    const q = query(collection(db, CLIENT_QUOTES_COLLECTION), where('projectId', 'in', part));
    const snap = await getDocs(q);
    const byProject = new Map<string, ClientQuote[]>();
    for (const d of snap.docs) {
      const c = { id: d.id, ...d.data() } as ClientQuote;
      const list = byProject.get(c.projectId) ?? [];
      list.push(c);
      byProject.set(c.projectId, list);
    }
    for (const [pid, quotes] of byProject) {
      if (quotes.length === 0) {
        out.set(pid, null);
        continue;
      }
      const sorted = [...quotes].sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
      out.set(pid, sorted[0] ?? null);
    }
  }
  return out;
}

/**
 * Project IDs that have a SalesOrder document (`designProjectId`), batched.
 * Complement to `DesignProject.linkedSalesOrderId` (denormalized pointer).
 */
export async function fetchProjectIdsWithSalesOrderDocuments(projectIds: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (projectIds.length === 0) return found;

  for (const part of chunk(projectIds, 10)) {
    if (part.length === 0) continue;
    const q = query(collection(db, SO_COLLECTION), where('designProjectId', 'in', part));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as { designProjectId?: string };
      if (data.designProjectId) found.add(data.designProjectId);
    }
  }
  return found;
}

/**
 * A project is considered to have a Sales Order if the project doc has
 * `linkedSalesOrderId` **or** at least one `salesOrders` document references
 * this `designProjectId`.
 */
export function projectHasSalesOrder(
  project: DesignProject,
  soDocProjectIds: Set<string>,
): boolean {
  if (project.linkedSalesOrderId) return true;
  return soDocProjectIds.has(project.id);
}

export interface CommercialSnapshot {
  /** Latest quote per project (or null) */
  latestQuoteByProject: Map<string, ClientQuote | null>;
  /** Derived signal (for filters/badges) */
  quoteSignalByProject: Map<string, QuoteCommercialSignal>;
  /** Project IDs with SO via Firestore + linked field (merged in resolveHasSalesOrderSet) */
  salesOrderFromDocuments: Set<string>;
}

/**
 * `hasSalesOrder` set includes every project with `linkedSalesOrderId` OR a matching `salesOrders` row.
 */
export function resolveHasSalesOrderSet(
  projects: DesignProject[],
  soDocProjectIds: Set<string>,
): Set<string> {
  const s = new Set<string>(soDocProjectIds);
  for (const p of projects) {
    if (p.linkedSalesOrderId) s.add(p.id);
  }
  return s;
}

/**
 * Load quote + SO presence for dashboard filters. Call from a debounced effect.
 */
export async function loadCommercialSnapshot(projects: DesignProject[]): Promise<CommercialSnapshot> {
  const ids = projects.map((p) => p.id);
  const withoutLinkedSo = ids.filter((id) => {
    const p = projects.find((x) => x.id === id);
    return p && !p.linkedSalesOrderId;
  });
  const [latestQuoteByProject, salesOrderFromDocuments] = await Promise.all([
    fetchLatestClientQuoteByProjectId(ids),
    fetchProjectIdsWithSalesOrderDocuments(withoutLinkedSo),
  ]);
  const quoteSignalByProject = new Map<string, QuoteCommercialSignal>();
  for (const pid of ids) {
    const q = latestQuoteByProject.get(pid) ?? null;
    quoteSignalByProject.set(pid, deriveQuoteCommercialSignal(q));
  }
  return { latestQuoteByProject, quoteSignalByProject, salesOrderFromDocuments };
}
