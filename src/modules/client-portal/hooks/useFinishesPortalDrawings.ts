/**
 * useFinishesPortalDrawings — feeds the portal Plans & drawings index.
 *
 * Drawings are surfaced via `designSignOffs` — every issued drawing
 * pack in DawinOS goes through a signoff record, which is the only
 * collection where the portal has a clear access path (one entry per
 * issued revision, with documents attached).
 *
 * Status buckets:
 *   - awaiting    (sent_to_client)              → signal red
 *   - approved    (approved)
 *   - superseded  (rejected | expired | superseded)
 *   - draft       (draft — still internal, surfaced as "Coming soon")
 *
 * Each drawing maps to a `DrawingItem` that also feeds the detail page
 * (resolved by signOffNumber from the URL).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { DesignProject } from '@/modules/design-manager/types';
import type { DesignSignOff, SalesOrder } from '@/modules/sales-orders/types';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export type DrawingBucket = 'awaiting' | 'approved' | 'superseded' | 'draft';

export interface DrawingItem {
  id: string;
  number: string;
  title: string;
  description?: string;
  designVersion: number;
  scopeVersion: number;
  documentCount: number;
  /** Open pin count (kept zero until pin data exists). */
  openPinCount: number;
  issuedAt?: Date;
  expiresAt?: Date;
  bucket: DrawingBucket;
  raw: DesignSignOff;
}

export interface DrawingCounts {
  awaiting: number;
  approved: number;
  superseded: number;
  draft: number;
}

export interface PortalDrawingsData {
  project: DesignProject;
  salesOrder: SalesOrder | null;
  items: DrawingItem[];
  counts: DrawingCounts;
  /** Most recently issued drawing in any bucket — used by the index card. */
  lastIssued?: DrawingItem;
}

interface State {
  data: PortalDrawingsData | null;
  loading: boolean;
  error: Error | null;
}

export function useFinishesPortalDrawings(code: string | undefined): State {
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
        if (project.linkedSalesOrderId) so = await getSalesOrderById(project.linkedSalesOrderId);
        if (!so) so = await getSalesOrderForProject(project.id);

        const signOffs = so ? await fetchSignOffs(so.id) : [];
        const items = signOffs.map(mapSignOff).sort(sortDrawings);

        const counts: DrawingCounts = {
          awaiting: items.filter((i) => i.bucket === 'awaiting').length,
          approved: items.filter((i) => i.bucket === 'approved').length,
          superseded: items.filter((i) => i.bucket === 'superseded').length,
          draft: items.filter((i) => i.bucket === 'draft').length,
        };

        const lastIssued = [...items]
          .filter((i) => i.issuedAt)
          .sort((a, b) => (b.issuedAt!.getTime() - a.issuedAt!.getTime()))[0];

        if (cancelled) return;
        setState({
          data: { project, salesOrder: so, items, counts, lastIssued },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err as Error });
      }
    })();

    return () => { cancelled = true; };
  }, [code, user?.uid]);

  return state;
}

/**
 * Look up a single drawing by signOff number (URL-friendly). Reuses
 * the same fetch path as the index so subsequent navigations are warm
 * if the index has already been visited.
 */
export function useFinishesPortalDrawing(
  code: string | undefined,
  drawingId: string | undefined,
): { drawing: DrawingItem | null; loading: boolean; error: Error | null } {
  const { data, loading, error } = useFinishesPortalDrawings(code);
  if (loading || error || !data || !drawingId) {
    return { drawing: null, loading, error };
  }
  const target = drawingId.toLowerCase();
  const drawing = data.items.find((d) => {
    return (
      d.id === drawingId
      || d.number.toLowerCase() === target
      || d.number.toLowerCase().replace(/\s+/g, '-') === target
      || idOf(d).toLowerCase() === target
    );
  }) ?? null;
  return { drawing, loading: false, error: null };
}

/** URL slug for a drawing (lowercase, hyphen-separated). */
export function idOf(d: DrawingItem): string {
  return d.number.toLowerCase().replace(/\s+/g, '-');
}

async function fetchSignOffs(salesOrderId: string): Promise<DesignSignOff[]> {
  try {
    const snap = await getDocs(query(
      collection(db, 'designSignOffs'),
      where('salesOrderId', '==', salesOrderId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DesignSignOff);
  } catch {
    return [];
  }
}

function mapSignOff(s: DesignSignOff): DrawingItem {
  return {
    id: s.id,
    number: s.signOffNumber,
    title: s.title,
    description: s.description,
    designVersion: s.designVersion,
    scopeVersion: s.scopeVersion,
    documentCount: s.designDocuments?.length ?? 0,
    openPinCount: 0,
    issuedAt: tsToDate(s.sentToClientAt) ?? tsToDate(s.createdAt),
    expiresAt: tsToDate(s.expiresAt),
    bucket: bucketFor(s.status),
    raw: s,
  };
}

function bucketFor(s: DesignSignOff['status']): DrawingBucket {
  if (s === 'sent_to_client') return 'awaiting';
  if (s === 'approved') return 'approved';
  if (s === 'rejected' || s === 'expired' || s === 'superseded') return 'superseded';
  return 'draft';
}

function sortDrawings(a: DrawingItem, b: DrawingItem): number {
  // awaiting first, then approved (most recent), then superseded, drafts last
  const bucketOrder: Record<DrawingBucket, number> = {
    awaiting: 0, approved: 1, superseded: 2, draft: 3,
  };
  if (a.bucket !== b.bucket) return bucketOrder[a.bucket] - bucketOrder[b.bucket];
  const aMs = a.issuedAt?.getTime() ?? 0;
  const bMs = b.issuedAt?.getTime() ?? 0;
  return bMs - aMs;
}

function tsToDate(t: unknown): Date | undefined {
  if (!t) return undefined;
  const maybe = t as { toDate?: () => Date };
  if (typeof maybe.toDate !== 'function') return undefined;
  return maybe.toDate();
}
