/**
 * useFinishesPortalApprovals — feeds the portal Approvals inbox.
 *
 * Pulls two collections scoped to the project's SalesOrder:
 *   - `designSignOffs` — drawings/specs sent to client for signature
 *   - `changeOrders`   — contract variations sent to client for signature
 *
 * Both are mapped into a single normalised `ApprovalItem[]` so the
 * inbox UI doesn't need to branch on type. Buckets:
 *   - awaiting  (status sent_to_client / pending_client)
 *   - team      (status draft / pending_internal — visible but not yours)
 *   - history   (approved / rejected / withdrawn / expired / superseded)
 *   - superseded (signOffs whose status == 'superseded')
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { collection, query, where, getDocs, type Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { DesignProject } from '@/modules/design-manager/types';
import type {
  SalesOrder,
  DesignSignOff,
  ChangeOrder,
} from '@/modules/sales-orders/types';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export type ApprovalKind = 'signoff' | 'change_order';

export type ApprovalBucket = 'awaiting' | 'team' | 'history' | 'superseded';

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  raw: DesignSignOff | ChangeOrder;
  /** Display tag e.g. `Shop drawing · SD-104 Rev C` or `Quotation · Q-019 v2`. */
  tag: string;
  /** Headline title — `Stone variation — Calacatta upgrade`. */
  title: string;
  /** Subtitle: shorter version / financial delta hint. */
  sub?: string;
  /** Currency-style amount for COs; undefined for signoffs. */
  amount?: string;
  /** Due / sent / expires date in a single sortable Date. */
  dueDate?: Date;
  /** Bucket the item belongs to. */
  bucket: ApprovalBucket;
  /** True if the item is the most-urgent (signal-red) in its bucket. */
  signal: boolean;
}

export interface PortalApprovalsData {
  project: DesignProject;
  salesOrder: SalesOrder;
  items: ApprovalItem[];
  counts: Record<ApprovalBucket, number>;
}

interface State {
  data: PortalApprovalsData | null;
  loading: boolean;
  error: Error | null;
  /**
   * Call after a write (approve / reject) to pull the freshest state
   * from Firestore. Quietly re-runs the same query graph that the
   * initial mount runs.
   */
  refetch: () => void;
}

export function useFinishesPortalApprovals(code: string | undefined): State {
  const { user } = useAuth();
  const [reloadCounter, setReloadCounter] = useState(0);
  const refetch = useCallback(() => setReloadCounter((n) => n + 1), []);
  const [state, setState] = useState<Omit<State, 'refetch'>>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    // Quiet refetch — keep current data visible while the fresh query is in flight.
    setState((prev) => (prev.data ? { ...prev, loading: true } : { data: null, loading: true, error: null }));

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

        const [signOffs, changeOrders] = await Promise.all([
          fetchSignOffsForSO(so.id),
          fetchChangeOrdersForSO(so.id),
        ]);

        const items = [
          ...signOffs.map((s) => mapSignOff(s, so!.currency)),
          ...changeOrders.map((c) => mapChangeOrder(c, so!.currency)),
        ];

        // Within each bucket, the closest due-date items are signal-flagged
        // (so the inbox view shows them in red without us needing to compute
        // it at render time).
        markSignalUrgent(items);

        // Sort: awaiting first (soonest due → latest), then team, then
        // history (most recent first), superseded last.
        items.sort(approvalSorter);

        const counts: Record<ApprovalBucket, number> = {
          awaiting: items.filter((i) => i.bucket === 'awaiting').length,
          team: items.filter((i) => i.bucket === 'team').length,
          history: items.filter((i) => i.bucket === 'history').length,
          superseded: items.filter((i) => i.bucket === 'superseded').length,
        };

        if (cancelled) return;
        setState({
          data: { project, salesOrder: so, items, counts },
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
  }, [code, user?.uid, reloadCounter]);

  return { ...state, refetch };
}

async function fetchSignOffsForSO(salesOrderId: string): Promise<DesignSignOff[]> {
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

function mapSignOff(s: DesignSignOff, _currency: string): ApprovalItem {
  return {
    id: s.id,
    kind: 'signoff',
    raw: s,
    tag: `Shop drawing · ${s.signOffNumber}`,
    title: s.title,
    sub: s.description?.slice(0, 120) || (s.designDocuments?.length ? `${s.designDocuments.length} document${s.designDocuments.length === 1 ? '' : 's'}` : undefined),
    dueDate: tsToDate(s.expiresAt) || tsToDate(s.sentToClientAt),
    bucket: bucketForSignOff(s.status),
    signal: false,
  };
}

function mapChangeOrder(c: ChangeOrder, currency: string): ApprovalItem {
  const tag = c.changeOrderNumber.startsWith('Q-')
    ? `Quotation · ${c.changeOrderNumber}`
    : `Change order · ${c.changeOrderNumber}`;
  const delta = c.priceImpact ?? 0;
  const deltaStr = delta === 0
    ? ''
    : ` · ${delta >= 0 ? '+' : '-'}${currency} ${formatAmount(Math.abs(delta))} vs prior`;
  return {
    id: c.id,
    kind: 'change_order',
    raw: c,
    tag,
    title: c.title,
    sub: (c.description?.slice(0, 90) || c.reason?.slice(0, 90) || '') + deltaStr,
    amount: `${currency} ${formatAmount(c.newOrderTotal)}`,
    dueDate: tsToDate(c.submittedToClientAt),
    bucket: bucketForChangeOrder(c.status),
    signal: false,
  };
}

function bucketForSignOff(status: DesignSignOff['status']): ApprovalBucket {
  if (status === 'sent_to_client') return 'awaiting';
  if (status === 'draft') return 'team';
  if (status === 'superseded') return 'superseded';
  return 'history';
}

function bucketForChangeOrder(status: ChangeOrder['status']): ApprovalBucket {
  if (status === 'pending_client') return 'awaiting';
  if (status === 'draft' || status === 'pending_internal') return 'team';
  if (status === 'withdrawn') return 'superseded';
  return 'history';
}

function markSignalUrgent(items: ApprovalItem[]): void {
  const awaiting = items.filter((i) => i.bucket === 'awaiting');
  // Mark every awaiting item as signal — they all need client action.
  // (We could narrow to "closest due" if the inbox gets noisy.)
  for (const i of awaiting) i.signal = true;
}

function approvalSorter(a: ApprovalItem, b: ApprovalItem): number {
  const bucketOrder: Record<ApprovalBucket, number> = {
    awaiting: 0, team: 1, history: 2, superseded: 3,
  };
  if (a.bucket !== b.bucket) return bucketOrder[a.bucket] - bucketOrder[b.bucket];
  // Within awaiting/team: nearest due first; within history: most recent first.
  const aMs = a.dueDate?.getTime() ?? 0;
  const bMs = b.dueDate?.getTime() ?? 0;
  if (a.bucket === 'history' || a.bucket === 'superseded') return bMs - aMs;
  return aMs - bMs;
}

function tsToDate(t: Timestamp | undefined): Date | undefined {
  if (!t || typeof (t as Timestamp).toDate !== 'function') return undefined;
  return (t as Timestamp).toDate();
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}Bn`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}
