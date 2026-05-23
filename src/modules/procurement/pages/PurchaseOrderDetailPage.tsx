/**
 * /procurement/purchase-orders/:poId — Detail view for a single PO with
 * its linked journal entry (if posted to GL).
 *
 * Shows the source invoice link, GL posting status, and breakdown of the
 * double-entry that posted on this PO's behalf.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPurchaseOrder } from '../services/purchase-order.service';
import { getJournalEntryForPO } from '../services/journal-entry.service';
import type { PurchaseOrder } from '../types/purchase-order.types';
import type { JournalEntry } from '../types/journal-entry.types';
import { PurchaseOrderStatusBadge } from '../components/PurchaseOrderStatusBadge';
import { PurchaseOrderKindBadge } from '../components/PurchaseOrderKindBadge';
import { getSupplier } from '@/modules/suppliers/services/supplier.service';
import type { Supplier } from '@/modules/suppliers/types/supplier.types';

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

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams<{ poId: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [je, setJe] = useState<JournalEntry | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poId) return;
    setLoading(true);
    setError(null);
    Promise.all([getPurchaseOrder(poId), getJournalEntryForPO(poId)])
      .then(async ([poDoc, jeDoc]) => {
        setPo(poDoc);
        setJe(jeDoc);
        // Resolve supplierOrgId → Supplier (only relevant for media POs)
        if (poDoc?.supplierOrgId) {
          const s = await getSupplier(poDoc.supplierOrgId).catch(() => null);
          setSupplier(s);
        }
      })
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [poId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading purchase order…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!po) return <p className="p-6 text-sm text-muted-foreground">Purchase order not found.</p>;

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link
          to="/procurement/purchase-orders"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All purchase orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold" data-testid="po-id">{po.id}</h1>
          <PurchaseOrderKindBadge kind={po.kind} />
          <PurchaseOrderStatusBadge status={po.status} />
        </div>
      </header>

      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Procurement details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Amount</dt>
            <dd className="font-medium" data-testid="po-amount">
              {formatMoney(po.amountMinor, po.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Master Job</dt>
            <dd className="font-mono text-xs">{po.masterJobId}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source invoice</dt>
            <dd className="font-mono text-xs">{po.sourceInvoiceId}</dd>
          </div>
          {po.supplierProfileId && (
            <div>
              <dt className="text-xs text-muted-foreground">Talent profile</dt>
              <dd className="font-mono text-xs">{po.supplierProfileId}</dd>
            </div>
          )}
          {po.supplierOrgId && (
            <div>
              <dt className="text-xs text-muted-foreground">Supplier</dt>
              <dd className="text-xs">
                {supplier ? (
                  <Link
                    to={`/suppliers/${supplier.id}`}
                    className="hover:underline"
                    data-testid="po-supplier-link"
                  >
                    {supplier.name}
                  </Link>
                ) : (
                  <span className="font-mono text-muted-foreground">{po.supplierOrgId}</span>
                )}
              </dd>
            </div>
          )}
          {po.mediaPlanId && (
            <div>
              <dt className="text-xs text-muted-foreground">Media plan</dt>
              <dd className="font-mono text-xs">{po.mediaPlanId}</dd>
            </div>
          )}
          {po.vehicleType && (
            <div>
              <dt className="text-xs text-muted-foreground">Vehicle type</dt>
              <dd>{po.vehicleType}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Raised at</dt>
            <dd>{formatDate(po.raisedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">GL posted</dt>
            <dd>{po.postedToGL ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border bg-card p-4" data-testid="po-je-section">
        <h2 className="mb-3 text-sm font-medium">Linked journal entry</h2>
        {!je && (
          <p className="text-sm text-muted-foreground">
            No journal entry posted yet. The finance consumer posts a JE within seconds
            of the PO being raised.
          </p>
        )}
        {je && (
          <>
            <div className="mb-4 flex items-center justify-between text-sm">
              <Link
                to={`/procurement/journal-entries/${je.id}`}
                className="font-mono text-xs hover:underline"
                data-testid="je-link"
              >
                {je.id}
              </Link>
              <span className="text-xs text-muted-foreground">
                Posted {formatDate(je.postedAt)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase text-muted-foreground">
                    <th className="py-1 font-medium">Account</th>
                    <th className="py-1 text-right font-medium">Debit</th>
                    <th className="py-1 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {je.debits.map((line, i) => (
                    <tr key={`debit-${i}`} className="border-t">
                      <td className="py-1">
                        <span className="font-mono text-[10px]">{line.accountCode}</span>{' '}
                        <span className="text-muted-foreground">{line.accountName}</span>
                      </td>
                      <td className="py-1 text-right font-medium">
                        {formatMoney(line.amountMinor, je.currency)}
                      </td>
                      <td className="py-1 text-right text-muted-foreground">—</td>
                    </tr>
                  ))}
                  {je.credits.map((line, i) => (
                    <tr key={`credit-${i}`} className="border-t">
                      <td className="py-1">
                        <span className="font-mono text-[10px]">{line.accountCode}</span>{' '}
                        <span className="text-muted-foreground">{line.accountName}</span>
                      </td>
                      <td className="py-1 text-right text-muted-foreground">—</td>
                      <td className="py-1 text-right font-medium">
                        {formatMoney(line.amountMinor, je.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
