/**
 * /billing/client-invoices/:invoiceId — detail view with the
 * Issue / Record Payment CTAs called for in the task spec.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getClientInvoice,
  issueClientInvoice,
  recordClientPayment,
} from '../services/client-invoice.service';
import type { ClientInvoice } from '../types/client-invoice.types';
import { CLIENT_INVOICE_STATUS_LABEL } from '../constants/statuses';
import { toClientFacingInvoice } from '../services/client-friendly';
import { InvoicePDFPreview } from '../components/InvoicePDFPreview';

export function ClientInvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<ClientInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  function refresh() {
    if (!invoiceId) return;
    setLoading(true);
    getClientInvoice(invoiceId)
      .then(setInvoice)
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  }

  if (!invoiceId) return <div className="p-6">Missing invoice ID.</div>;
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!invoice) return <div className="p-6">Invoice not found.</div>;

  const clientFacing = toClientFacingInvoice(invoice);

  async function onIssue() {
    if (!invoiceId) return;
    setActionInFlight('issue');
    try {
      await issueClientInvoice(invoiceId);
      refresh();
    } catch (err) {
      alert(`Failed to issue: ${String(err)}`);
    } finally {
      setActionInFlight(null);
    }
  }

  async function onRecordPayment() {
    if (!invoiceId || !invoice) return;
    const amountStr = window.prompt('Payment amount (in minor units):');
    if (!amountStr) return;
    const paymentRef = window.prompt('Payment reference:');
    if (!paymentRef) return;
    setActionInFlight('payment');
    try {
      await recordClientPayment(invoiceId, {
        amountMinor: Number(amountStr),
        paymentRef,
      });
      refresh();
    } catch (err) {
      alert(`Failed to record payment: ${String(err)}`);
    } finally {
      setActionInFlight(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-lg">{invoice.id}</h1>
          <p className="text-sm text-muted-foreground">
            Master job {invoice.masterJobId} · Client {invoice.clientId}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">
            {CLIENT_INVOICE_STATUS_LABEL[invoice.status]}
          </div>
          <div className="font-mono text-lg">
            {invoice.total.currency} {(invoice.total.amountMinor / 100).toLocaleString()}
          </div>
        </div>
      </header>

      <div className="flex gap-2">
        {invoice.status === 'DRAFT' && (
          <button
            onClick={onIssue}
            disabled={actionInFlight === 'issue'}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {actionInFlight === 'issue' ? 'Issuing…' : 'Issue Invoice'}
          </button>
        )}
        {(invoice.status === 'ISSUED' || invoice.status === 'PART_PAID') && (
          <button
            onClick={onRecordPayment}
            disabled={actionInFlight === 'payment'}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {actionInFlight === 'payment' ? 'Recording…' : 'Record Payment'}
          </button>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Internal view (AM / Finance)
        </h2>
        <table className="w-full table-fixed text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-1/2 py-1">Description</th>
              <th className="py-1">Source subsidiary</th>
              <th className="py-1 text-right">Cost (minor)</th>
              <th className="py-1 text-right">Charge (minor)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="py-1">{line.description}</td>
                <td className="py-1 font-mono text-xs">{line.sourceSubsidiaryId}</td>
                <td className="py-1 text-right font-mono">{line.costMinor}</td>
                <td className="py-1 text-right font-mono">{line.amountMinor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Client-facing preview
        </h2>
        <InvoicePDFPreview invoice={clientFacing} />
      </section>
    </div>
  );
}

export default ClientInvoiceDetailPage;
