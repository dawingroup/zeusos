// ============================================================================
// INVOICES PAGE
// Migrated to shared <KPICard> + <DataTable> primitives.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display/Banner';
import {
  KPICard,
  KPIGrid,
  DataTable,
  RagBadge,
  type DataTableColumn,
} from '@/shared/components/data-display';
import { getQBOInvoices, syncQBOCategory } from '../services/qboSyncService';
import type { QBOInvoice } from '../types/integrations.types';

const COMPANY_ID = 'zeus-group';

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function StatusCell({ status }: { status: string }) {
  if (status === 'paid') return <RagBadge tone="green">Paid</RagBadge>;
  if (status === 'overdue') return <RagBadge tone="red">Overdue</RagBadge>;
  return <RagBadge tone="blue">Sent</RagBadge>;
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<QBOInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQBOInvoices(COMPANY_ID);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncQBOCategory(COMPANY_ID, 'invoices');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const totalAmt = invoices.reduce((s, i) => s + i.totalAmt, 0);
  const totalBalance = invoices.reduce((s, i) => s + i.balance, 0);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

  const columns: DataTableColumn<QBOInvoice>[] = useMemo(
    () => [
      {
        key: 'docNumber',
        label: 'Invoice #',
        type: 'mono',
        render: (row) => (
          <span className="font-mono text-[12px]" style={{ color: 'var(--fg-primary)' }}>
            {row.docNumber || row.qboId}
          </span>
        ),
        width: 150,
      },
      {
        key: 'customerName',
        label: 'Customer',
        render: (row) => row.customerName || '—',
      },
      {
        key: 'txnDate',
        label: 'Date',
        type: 'date',
        render: (row) => row.txnDate || '—',
        width: 110,
      },
      {
        key: 'dueDate',
        label: 'Due Date',
        type: 'date',
        render: (row) => row.dueDate || '—',
        width: 110,
      },
      {
        key: 'totalAmt',
        label: 'Total',
        align: 'right',
        render: (row) => (
          <span className="tabular-nums font-medium" style={{ color: 'var(--fg-primary)' }}>
            {formatUSD(row.totalAmt)}
          </span>
        ),
      },
      {
        key: 'balance',
        label: 'Balance',
        align: 'right',
        render: (row) => (
          <span
            className="tabular-nums"
            style={{
              color: row.balance > 0 ? 'var(--rag-amber)' : 'var(--fg-tertiary)',
            }}
          >
            {formatUSD(row.balance)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusCell status={row.status} />,
        width: 110,
      },
    ],
    [],
  );

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>
            <FileText
              className="inline-block h-5 w-5 mr-2 -mt-1"
              style={{ color: 'var(--rag-green)' }}
            />
            Invoices
          </h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            QuickBooks Online synced invoices
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing || loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>

      {error && <Banner tone="danger" title="Couldn't load invoices" message={error} />}

      {/* KPI row */}
      <KPIGrid>
        <KPICard
          label="Total Invoiced"
          value={loading ? '—' : formatUSD(totalAmt)}
          unit="USD"
        />
        <KPICard
          label="Outstanding"
          value={loading ? '—' : formatUSD(totalBalance)}
          unit="USD"
          trend={totalBalance > 0 ? 'down' : 'flat'}
          delta={
            loading || totalAmt === 0
              ? undefined
              : `${((totalBalance / totalAmt) * 100).toFixed(1)}%`
          }
          sparkColor="var(--rag-amber)"
        />
        <KPICard
          label="Paid"
          value={loading ? '—' : paidCount}
          trend="up"
          sparkColor="var(--rag-green)"
        />
        <KPICard
          label="Overdue"
          value={loading ? '—' : overdueCount}
          trend={overdueCount > 0 ? 'down' : 'flat'}
          sparkColor="var(--rag-red)"
        />
      </KPIGrid>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div
            className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : invoices.length === 0 ? (
        <div
          className="text-center py-12 rounded-[10px] border bg-[var(--bg-surface)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--fg-tertiary)' }}
        >
          <FileText className="h-9 w-9 mx-auto mb-2 opacity-40" />
          <p className="font-medium text-[14px]" style={{ color: 'var(--fg-primary)' }}>
            No invoices synced yet
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--fg-secondary)' }}>
            Click "Sync Now" to pull invoices from QuickBooks
          </p>
        </div>
      ) : (
        <DataTable<QBOInvoice>
          data={invoices}
          columns={columns}
          search="Search by invoice #, customer…"
          filters={[
            {
              label: 'Status',
              key: 'status',
              options: ['All', 'paid', 'sent', 'overdue'],
            },
          ]}
        />
      )}

      {/* Quick-look badges below (legend) */}
      <div className="flex items-center gap-3 text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
        <CheckCircle className="h-3.5 w-3.5" /> Paid&nbsp;·
        <Clock className="h-3.5 w-3.5" /> Outstanding&nbsp;·
        <AlertCircle className="h-3.5 w-3.5" /> Overdue
      </div>
    </div>
  );
}

export default InvoicesPage;
