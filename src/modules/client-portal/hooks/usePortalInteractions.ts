/**
 * usePortalInteractions — derives an activity timeline for the
 * portal Interactions page from the project's existing approval +
 * signoff records.
 *
 * Sources:
 *   - `changeOrders.approvalEvents` subcollection (CO approve/reject)
 *   - `designSignOffs` status transitions (sent / approved / rejected)
 *
 * Each event becomes a `InteractionEntry` with a kind, title, date,
 * actor, and a 1-line description. The hook sorts newest-first.
 *
 * Light scope by design — eventually the staff app will keep a real
 * `interactions` collection (call notes, site visits, etc.). For now
 * we synthesise what's available from existing collections so the
 * Interactions tab isn't pure mock.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ChangeOrder, DesignSignOff, SalesOrder } from '@/modules/sales-orders/types';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export type InteractionKind = 'Decision' | 'Signoff' | 'Quote' | 'Issued' | 'Update';

export interface InteractionEntry {
  id: string;
  kind: InteractionKind;
  title: string;
  with: string;
  date: Date;
  /** "8 May 14:22" friendly stamp. */
  dateLabel: string;
  body: string;
  /** Highlight the row — used for client decisions / approvals. */
  star?: boolean;
}

interface State {
  entries: InteractionEntry[];
  loading: boolean;
  error: Error | null;
}

export function usePortalInteractions(code: string | undefined): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ entries: [], loading: true, error: null });

  useEffect(() => {
    if (!code) {
      setState({ entries: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ entries: [], loading: true, error: null });

    (async () => {
      try {
        const project = await getPortalProjectByCode(code);
        if (!project) throw new Error(`Project ${code} not found`);
        assertProjectAccess(user, project);

        let so: SalesOrder | null = null;
        if (project.linkedSalesOrderId) so = await getSalesOrderById(project.linkedSalesOrderId);
        if (!so) so = await getSalesOrderForProject(project.id);

        const entries: InteractionEntry[] = [];

        if (so) {
          const [cos, signOffs, events] = await Promise.all([
            fetchChangeOrders(so.id),
            fetchSignOffs(so.id),
            fetchAllApprovalEvents(),
          ]);

          // Change-order lifecycle: created → submitted → approved/rejected.
          for (const co of cos) {
            const submitted = tsToDate(co.submittedToClientAt);
            if (submitted) {
              entries.push({
                id: `${co.id}-submitted`,
                kind: 'Quote',
                title: `${co.changeOrderNumber} issued · ${co.title}`,
                with: co.submittedToClientBy || co.createdBy,
                date: submitted,
                dateLabel: friendly(submitted),
                body: co.description?.slice(0, 140) || co.reason?.slice(0, 140) || '—',
              });
            }
            const approved = tsToDate(co.clientApprovedAt);
            if (approved) {
              entries.push({
                id: `${co.id}-approved`,
                kind: 'Decision',
                title: `${co.changeOrderNumber} approved`,
                with: co.clientApprovalEvidence?.replace(/^portal:/, '') || 'client',
                date: approved,
                dateLabel: friendly(approved),
                body: co.priceImpact ? `Locked ${formatMoney(co.priceImpact)} ${co.previousOrderTotal ? '(' + (co.priceImpact >= 0 ? '+' : '−') + Math.round(Math.abs(co.priceImpact) / Math.max(co.previousOrderTotal, 1) * 1000) / 10 + '%)' : ''}` : 'Change sealed.',
                star: true,
              });
            }
            const rejected = tsToDate(co.rejectedAt);
            if (rejected) {
              entries.push({
                id: `${co.id}-rejected`,
                kind: 'Decision',
                title: `${co.changeOrderNumber} rejected`,
                with: co.rejectedBy?.replace(/^portal:/, '') || 'client',
                date: rejected,
                dateLabel: friendly(rejected),
                body: co.rejectionReason || 'Sent back to the team for revision.',
              });
            }
          }

          // Signoff lifecycle: sent → approved/rejected.
          for (const s of signOffs) {
            const sentAt = tsToDate(s.sentToClientAt);
            if (sentAt) {
              entries.push({
                id: `${s.id}-sent`,
                kind: 'Issued',
                title: `${s.signOffNumber} issued · ${s.title}`,
                with: s.createdBy,
                date: sentAt,
                dateLabel: friendly(sentAt),
                body: `${s.designDocuments?.length ?? 0} document${(s.designDocuments?.length ?? 0) === 1 ? '' : 's'} attached. Rev v${s.designVersion}.`,
              });
            }
            const approvedAt = tsToDate(s.clientApprovedAt);
            if (approvedAt) {
              entries.push({
                id: `${s.id}-approved`,
                kind: 'Signoff',
                title: `${s.signOffNumber} signed`,
                with: s.approvedByEmail || s.approvedByName || 'client',
                date: approvedAt,
                dateLabel: friendly(approvedAt),
                body: s.clientApprovalNotes || 'Sealed at the issued revision.',
                star: true,
              });
            }
            const rejectedAt = tsToDate(s.clientRejectedAt);
            if (rejectedAt) {
              entries.push({
                id: `${s.id}-rejected`,
                kind: 'Signoff',
                title: `${s.signOffNumber} returned for revision`,
                with: 'client',
                date: rejectedAt,
                dateLabel: friendly(rejectedAt),
                body: s.rejectionNotes || (s.rejectionReasons || []).join('; ') || 'Sent back to the design team.',
              });
            }
          }

          // Approval events subcollection (richer audit — includes
          // channel + actor metadata).
          for (const ev of events) {
            entries.push({
              id: ev.id,
              kind: 'Update',
              title: `${ev.coNumber} · ${prettyAction(ev.action)}`,
              with: ev.actorName || ev.actorId,
              date: ev.date,
              dateLabel: friendly(ev.date),
              body: ev.notes || `Via ${ev.channel}.`,
            });
          }
        }

        // Dedupe by id (some legacy data has co-submitted overlap with
        // events) and sort newest first.
        const seen = new Set<string>();
        const deduped = entries
          .filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (cancelled) return;
        setState({ entries: deduped, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ entries: [], loading: false, error: err as Error });
      }
    })();

    return () => { cancelled = true; };
  }, [code, user?.uid]);

  return state;
}

// ── helpers ─────────────────────────────────────────────────

async function fetchChangeOrders(salesOrderId: string): Promise<ChangeOrder[]> {
  try {
    const snap = await getDocs(query(collection(db, 'changeOrders'), where('salesOrderId', '==', salesOrderId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChangeOrder);
  } catch { return []; }
}

async function fetchSignOffs(salesOrderId: string): Promise<DesignSignOff[]> {
  try {
    const snap = await getDocs(query(collection(db, 'designSignOffs'), where('salesOrderId', '==', salesOrderId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DesignSignOff);
  } catch { return []; }
}

interface FlatApprovalEvent {
  id: string;
  coNumber: string;
  action: string;
  date: Date;
  actorId: string;
  actorName?: string;
  channel: string;
  notes?: string;
}

async function fetchAllApprovalEvents(): Promise<FlatApprovalEvent[]> {
  // We don't have a collection-group index for `approvalEvents` so
  // we can't list across all COs cheaply; for now, return empty and
  // rely on the lifecycle entries above (which cover the same data
  // through the CO doc itself).
  return [];
}

function tsToDate(t: unknown): Date | undefined {
  if (!t) return undefined;
  const maybe = t as { toDate?: () => Date };
  if (typeof maybe.toDate !== 'function') return undefined;
  return maybe.toDate();
}

function friendly(d: Date): string {
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}Bn`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function prettyAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
