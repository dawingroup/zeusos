/**
 * usePortalNotifications — derives the bell-icon notifications list
 * by joining the user's accessible projects with their open
 * approvals + signoffs + outstanding invoices. Globally-scoped to
 * the signed-in user, not per-project, so the same dropdown surfaces
 * "Vela needs your signature" alongside "Naqaa BOQ pack v3 awaiting"
 * for clients with multiple projects.
 *
 * No new collection — we synthesise the list from existing data so
 * we don't have to keep a separate `notifications` collection in
 * sync. When a `notifications` collection eventually exists, swap
 * the body and keep the same hook signature.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { DesignProject } from '@/modules/design-manager/types';
import type { ChangeOrder, DesignSignOff, SalesOrder } from '@/modules/sales-orders/types';
import {
  getPortalProjectsForUser,
  getSalesOrderForProject,
  getSalesOrderById,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';

export type NotificationKind = 'approval' | 'signoff' | 'invoice';

export interface PortalNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  sub: string;
  /** Project code (slug) — used for the link. */
  projectCode: string;
  /** Project display name. */
  projectName: string;
  /** Where the user lands when they click. */
  href: string;
  /** Due date (or sent date for signoffs / open milestones). */
  date?: Date;
  /** Sub-line "Due 16 May" / "Issued 9 May" etc. */
  dateLabel?: string;
  /** Mark as urgent (signal-red). */
  urgent?: boolean;
}

interface State {
  notifications: PortalNotification[];
  loading: boolean;
  error: Error | null;
}

export function usePortalNotifications(): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ notifications: [], loading: true, error: null });

  useEffect(() => {
    if (!user?.uid) {
      setState({ notifications: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      try {
        const projects = await getPortalProjectsForUser(user.uid);
        // For each project, find its open work in parallel.
        const perProject = await Promise.all(
          projects.map((p) => collectForProject(p)),
        );
        const flat = perProject.flat();
        // Most-urgent first: invoices > approvals > signoffs;
        // within kind, soonest-due first.
        flat.sort((a, b) => {
          if (a.kind !== b.kind) return kindOrder(a.kind) - kindOrder(b.kind);
          const aMs = a.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bMs = b.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aMs - bMs;
        });
        if (cancelled) return;
        setState({ notifications: flat, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ notifications: [], loading: false, error: err as Error });
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid]);

  return state;
}

async function collectForProject(project: DesignProject): Promise<PortalNotification[]> {
  let so: SalesOrder | null = null;
  if (project.linkedSalesOrderId) so = await getSalesOrderById(project.linkedSalesOrderId);
  if (!so) so = await getSalesOrderForProject(project.id);

  const notifications: PortalNotification[] = [];

  if (!so) return notifications;

  // 1. Outstanding payment milestone — most urgent.
  const openMilestone = findOpenMilestone(so);
  if (openMilestone) {
    notifications.push({
      id: `${project.id}-invoice-${openMilestone.label}`,
      kind: 'invoice',
      title: `${openMilestone.label} due`,
      sub: `${formatMoney(openMilestone.amount)} ${so.currency} on ${project.code}`,
      projectCode: project.code,
      projectName: project.name,
      href: `/portal/p/${project.code}/financials`,
      date: openMilestone.dueDate,
      dateLabel: openMilestone.dueDate ? `Due ${formatDate(openMilestone.dueDate)}` : 'Due now',
      urgent: openMilestone.urgent,
    });
  }

  // 2. Open change orders awaiting client.
  try {
    const cosSnap = await getDocs(query(
      collection(db, 'changeOrders'),
      where('salesOrderId', '==', so.id),
      where('status', '==', 'pending_client'),
    ));
    for (const doc of cosSnap.docs) {
      const co = { id: doc.id, ...doc.data() } as ChangeOrder;
      const submitted = tsToDate(co.submittedToClientAt);
      notifications.push({
        id: `${project.id}-co-${co.id}`,
        kind: 'approval',
        title: `${co.changeOrderNumber} · ${co.title}`,
        sub: `Quotation awaiting your signature on ${project.name}`,
        projectCode: project.code,
        projectName: project.name,
        href: `/portal/p/${project.code}/approvals`,
        date: submitted,
        dateLabel: submitted ? `Issued ${formatDate(submitted)}` : 'Awaiting',
        urgent: true,
      });
    }
  } catch { /* permission-denied gracefully → no entries */ }

  // 3. Open design signoffs awaiting client.
  try {
    const soSnap = await getDocs(query(
      collection(db, 'designSignOffs'),
      where('salesOrderId', '==', so.id),
      where('status', '==', 'sent_to_client'),
    ));
    for (const doc of soSnap.docs) {
      const s = { id: doc.id, ...doc.data() } as DesignSignOff;
      const sentAt = tsToDate(s.sentToClientAt);
      const expiresAt = tsToDate(s.expiresAt);
      notifications.push({
        id: `${project.id}-signoff-${s.id}`,
        kind: 'signoff',
        title: `${s.signOffNumber} · ${s.title}`,
        sub: `Drawing awaiting your signature on ${project.name}`,
        projectCode: project.code,
        projectName: project.name,
        href: `/portal/p/${project.code}/approvals`,
        date: expiresAt ?? sentAt,
        dateLabel: expiresAt
          ? `Expires ${formatDate(expiresAt)}`
          : (sentAt ? `Sent ${formatDate(sentAt)}` : 'Awaiting'),
        urgent: !!expiresAt && expiresAt.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3,
      });
    }
  } catch { /* permission-denied gracefully → no entries */ }

  return notifications;
}

function findOpenMilestone(so: SalesOrder): { label: string; amount: number; dueDate?: Date; urgent?: boolean } | null {
  const milestones = so.paymentTerms?.milestonePayments ?? [];
  const payments = so.payments ?? [];
  if (milestones.length === 0) return null;
  // Open = first milestone for which there's no recorded payment yet.
  const idx = payments.length;
  if (idx >= milestones.length) return null;
  const m = milestones[idx];
  const total = so.currentAmount || so.originalQuoteAmount || 0;
  return {
    label: m.label,
    amount: Math.round((m.percentage / 100) * total),
  };
}

function kindOrder(k: NotificationKind): number {
  return k === 'invoice' ? 0 : k === 'approval' ? 1 : 2;
}

function tsToDate(t: unknown): Date | undefined {
  if (!t) return undefined;
  const maybe = t as { toDate?: () => Date };
  if (typeof maybe.toDate !== 'function') return undefined;
  return maybe.toDate();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}Bn`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}
