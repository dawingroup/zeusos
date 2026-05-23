/**
 * /procurement/purchase-orders — Parent-org viewer for POs raised by the
 * Phase 4.1 procurement consumers.
 *
 * Subsidiary users cannot read this collection (firestore.rules enforces
 * parent-org-only). The page exists so finance / leadership can see the
 * procurement ledger that the upstream CFns populate.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { listPurchaseOrders } from '../services/purchase-order.service';
import type {
  PurchaseOrder,
  PurchaseOrderKind,
  PurchaseOrderStatus,
} from '../types/purchase-order.types';
import { PurchaseOrderStatusBadge } from '../components/PurchaseOrderStatusBadge';
import { PurchaseOrderKindBadge } from '../components/PurchaseOrderKindBadge';

const DEFAULT_ORG_ID = 'default';

const KIND_OPTIONS: Array<PurchaseOrderKind | 'ALL'> = [
  'ALL', 'TALENT_FREELANCER', 'MEDIA_SUPPLIER', 'VENDOR_OTHER',
];

const STATUS_OPTIONS: Array<PurchaseOrderStatus | 'ALL'> = [
  'ALL', 'OPEN', 'POSTED', 'CLOSED', 'VOID',
];

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function PurchaseOrdersListPage() {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [kindFilter, setKindFilter] = useState<PurchaseOrderKind | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listPurchaseOrders({
        orgId,
        kind: kindFilter === 'ALL' ? undefined : kindFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setPos(rows);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [user, orgId, kindFilter, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Procurement ledger raised by approved talent invoices and paid media supplier invoices.
            Parent-org visibility only.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as PurchaseOrderKind | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
            data-testid="po-kind-filter"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{k === 'ALL' ? 'All kinds' : k}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
            data-testid="po-status-filter"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
            ))}
          </select>
          <Link
            to="/procurement/purchase-orders/new"
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            data-testid="po-new-btn"
          >
            + New PO
          </Link>
        </div>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading purchase orders…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && pos.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No purchase orders found. They are created automatically when talent invoices are
          approved or media supplier invoices are paid.
        </div>
      )}

      {!loading && !error && pos.length > 0 && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm" data-testid="po-table">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 font-medium">PO ID</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium">Master Job</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Raised</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr
                  key={po.id}
                  className="border-t hover:bg-muted/30"
                  data-po-id={po.id}
                  data-po-source-invoice={po.sourceInvoiceId}
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link to={`/procurement/purchase-orders/${po.id}`} className="hover:underline">
                      {po.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <PurchaseOrderKindBadge kind={po.kind} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {po.masterJobId}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    {formatMoney(po.amountMinor, po.currency)}
                  </td>
                  <td className="px-4 py-2">
                    <PurchaseOrderStatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatDate(po.raisedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
