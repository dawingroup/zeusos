/**
 * /procurement/journal-entries/:jeId — Detail view for a single journal
 * entry with full debit/credit breakdown and source linkage.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJournalEntry, isBalanced } from '../services/journal-entry.service';
import type { JournalEntry } from '../types/journal-entry.types';

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

export default function JournalEntryDetailPage() {
  const { jeId } = useParams<{ jeId: string }>();
  const [je, setJe] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jeId) return;
    setLoading(true);
    setError(null);
    getJournalEntry(jeId)
      .then(setJe)
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [jeId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading journal entry…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!je) return <p className="p-6 text-sm text-muted-foreground">Journal entry not found.</p>;

  const totalDebits = je.debits.reduce((sum, line) => sum + line.amountMinor, 0);
  const totalCredits = je.credits.reduce((sum, line) => sum + line.amountMinor, 0);
  const balanced = isBalanced(je);
  const isFromPO = je.sourceDocKind === 'PurchaseOrderRaised';

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link
          to="/procurement/journal-entries"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All journal entries
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold" data-testid="je-id">{je.id}</h1>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
            balanced ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' : 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
          }`}>
            {balanced ? 'Balanced' : 'UNBALANCED'}
          </span>
        </div>
      </header>

      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Posting metadata</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Kind</dt>
            <dd>{je.kind}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Currency</dt>
            <dd>{je.currency}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Posted at</dt>
            <dd>{formatDate(je.postedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source kind</dt>
            <dd className="text-xs">{je.sourceDocKind}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source ID</dt>
            <dd className="font-mono text-xs">
              {isFromPO ? (
                <Link
                  to={`/procurement/purchase-orders/${je.sourceDocId}`}
                  className="hover:underline"
                  data-testid="je-source-po-link"
                >
                  {je.sourceDocId}
                </Link>
              ) : (
                je.sourceDocId
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Idempotency key</dt>
            <dd className="font-mono text-xs">{je.idempotencyKey || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border bg-card p-4" data-testid="je-lines-section">
        <h2 className="mb-3 text-sm font-medium">Double-entry breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 font-medium">Account</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Debit</th>
                <th className="py-2 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {je.debits.map((line, i) => (
                <tr key={`debit-${i}`} className="border-t">
                  <td className="py-2">
                    <span className="font-mono text-xs">{line.accountCode}</span>{' '}
                    <span className="text-muted-foreground">{line.accountName}</span>
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{line.description}</td>
                  <td className="py-2 text-right font-medium">
                    {formatMoney(line.amountMinor, je.currency)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">—</td>
                </tr>
              ))}
              {je.credits.map((line, i) => (
                <tr key={`credit-${i}`} className="border-t">
                  <td className="py-2">
                    <span className="font-mono text-xs">{line.accountCode}</span>{' '}
                    <span className="text-muted-foreground">{line.accountName}</span>
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{line.description}</td>
                  <td className="py-2 text-right text-muted-foreground">—</td>
                  <td className="py-2 text-right font-medium">
                    {formatMoney(line.amountMinor, je.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 text-xs font-semibold">
                <td colSpan={2} className="py-2">Total</td>
                <td className="py-2 text-right" data-testid="debit-total">
                  {formatMoney(totalDebits, je.currency)}
                </td>
                <td className="py-2 text-right" data-testid="credit-total">
                  {formatMoney(totalCredits, je.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
