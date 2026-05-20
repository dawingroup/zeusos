/**
 * useFinishesPortalFinancials — derives the data the portal Financials
 * screen needs (KPI strip, payment schedule, invoice register) from
 * the live SalesOrder + DesignProject.
 *
 * Wire-up logic:
 *   - **Payment schedule** is the cross-product of
 *     `SO.paymentTerms.milestonePayments[]` (the contractual breakdown)
 *     and `SO.payments[]` (the receipts that have actually landed).
 *     Milestones with a matching receipt are `paid`; the first
 *     unmatched milestone is `open` (the next billing trigger); the
 *     rest are `upcoming`. This is a heuristic — once a separate
 *     `invoices` collection exists we can swap to a per-doc status.
 *   - **Invoice register** is the same `payments[]` re-projected with
 *     a synthetic "next open" row appended.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type { Timestamp } from 'firebase/firestore';
import type { DesignProject } from '@/modules/design-manager/types';
import type { SalesOrder, PaymentRecord } from '@/modules/sales-orders/types';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export type ScheduleStatus = 'paid' | 'open' | 'upcoming';

export interface PaymentScheduleEntry {
  index: number;
  label: string;
  trigger?: string;
  percentage: number;
  amount: number;
  status: ScheduleStatus;
  paidOn?: Date;
  dueDate?: Date;
  invoiceRef?: string;
}

export interface InvoiceRow {
  id: string;
  number: string;
  description: string;
  issuedAt?: Date;
  dueAt?: Date;
  amount: number;
  currency: string;
  status: 'paid' | 'open';
  method?: string;
}

export interface PortalFinancialsData {
  project: DesignProject;
  salesOrder: SalesOrder;
  schedule: PaymentScheduleEntry[];
  invoices: InvoiceRow[];
  /** First open milestone (the one currently due). */
  openMilestone: PaymentScheduleEntry | null;
  /**
   * Running cumulative paid total, point per recorded receipt. Drives
   * the sparkline on the Paid KPI. Empty array when no payments have
   * been recorded.
   */
  paidSeries: number[];
}

interface State {
  data: PortalFinancialsData | null;
  loading: boolean;
  error: Error | null;
}

export function useFinishesPortalFinancials(code: string | undefined): State {
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

        const schedule = buildSchedule(so);
        const invoices = buildInvoices(so, schedule);
        const openMilestone = schedule.find((s) => s.status === 'open') ?? null;
        const paidSeries = buildPaidSeries(so);

        if (cancelled) return;
        setState({
          data: { project, salesOrder: so, schedule, invoices, openMilestone, paidSeries },
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

/**
 * Cumulative paid amount per recorded payment, ordered by date.
 * Prefixed with a 0 so the sparkline shows a clear baseline → growth
 * curve even when there are only a couple of receipts.
 */
function buildPaidSeries(so: SalesOrder): number[] {
  const payments = (so.payments ?? [])
    .slice()
    .sort((a, b) => {
      const aMs = a.paymentDate?.toMillis?.() ?? 0;
      const bMs = b.paymentDate?.toMillis?.() ?? 0;
      return aMs - bMs;
    });
  if (payments.length === 0) return [];
  const series: number[] = [0];
  let running = 0;
  for (const p of payments) {
    running += p.amount || 0;
    series.push(running);
  }
  return series;
}

function buildSchedule(so: SalesOrder): PaymentScheduleEntry[] {
  const milestones = so.paymentTerms?.milestonePayments ?? [];
  const payments = so.payments ?? [];
  const total = so.currentAmount || so.originalQuoteAmount || 0;

  return milestones.map((m, i) => {
    const pmt = payments[i] as PaymentRecord | undefined;
    let status: ScheduleStatus;
    if (pmt) status = 'paid';
    else if (i === payments.length) status = 'open';
    else status = 'upcoming';

    return {
      index: i,
      label: m.label,
      trigger: triggerHint(m.label),
      percentage: m.percentage,
      amount: Math.round((m.percentage / 100) * total),
      status,
      paidOn: pmt ? tsToDate(pmt.paymentDate) : undefined,
      invoiceRef: pmt?.receiptRef,
    };
  });
}

function buildInvoices(so: SalesOrder, schedule: PaymentScheduleEntry[]): InvoiceRow[] {
  const payments = so.payments ?? [];
  const currency = so.currency || 'UGX';

  // Settled invoices = each PaymentRecord with a receiptRef.
  const paid: InvoiceRow[] = payments
    .map((p, i): InvoiceRow | null => {
      if (!p.receiptRef) return null;
      const m = schedule[i];
      return {
        id: p.id || `pmt-${i}`,
        number: p.receiptRef,
        description: m ? `${m.label} milestone` : 'Payment',
        issuedAt: undefined,
        dueAt: tsToDate(p.paymentDate),
        amount: p.amount,
        currency: p.currency || currency,
        status: 'paid',
        method: p.method,
      };
    })
    .filter((x): x is InvoiceRow => x !== null);

  // Synthesise an "open" invoice for the next-due milestone if any.
  const open = schedule.find((s) => s.status === 'open');
  if (open) {
    paid.unshift({
      id: `open-${open.index}`,
      number: `INV-${String(open.index + 1).padStart(3, '0')}`,
      description: `${open.label} milestone`,
      amount: open.amount,
      currency,
      status: 'open',
      dueAt: open.dueDate,
    });
  }

  return paid;
}

function triggerHint(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('mobil')) return 'Contract signed';
  if (l.includes('design')) return 'Issued For Construction set sealed';
  if (l.includes('procurement')) return 'POs raised';
  if (l.includes('construction')) return 'Joinery on site';
  if (l.includes('handover')) return 'Practical completion';
  return '';
}

function tsToDate(t: Timestamp | undefined): Date | undefined {
  if (!t || typeof (t as Timestamp).toDate !== 'function') return undefined;
  return (t as Timestamp).toDate();
}
