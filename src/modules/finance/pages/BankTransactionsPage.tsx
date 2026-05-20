// ============================================================================
// BANK TRANSACTIONS PAGE
// Migrated to shared <KPICard> + <DataTable> primitives.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ArrowUpCircle, ArrowDownCircle, Banknote } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display/Banner';
import {
  KPICard,
  KPIGrid,
  DataTable,
  RagBadge,
  type DataTableColumn,
} from '@/shared/components/data-display';
import { getQBOBankTransactions, syncQBOCategory } from '../services/qboSyncService';
import type { QBOBankTransaction } from '../types/integrations.types';

const COMPANY_ID = 'dawinos';

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

export function BankTransactionsPage() {
  const [transactions, setTransactions] = useState<QBOBankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQBOBankTransactions(COMPANY_ID);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
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
      await syncQBOCategory(COMPANY_ID, 'bank_transactions');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const expenses = transactions.filter((t) => t.txnType === 'expense');
  const deposits = transactions.filter((t) => t.txnType === 'deposit');
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const totalDeposits = deposits.reduce((s, t) => s + t.amount, 0);

  const columns: DataTableColumn<QBOBankTransaction>[] = useMemo(
    () => [
      {
        key: 'txnDate',
        label: 'Date',
        type: 'date',
        render: (row) => row.txnDate || '—',
        width: 110,
      },
      {
        key: 'txnType',
        label: 'Type',
        width: 130,
        render: (row) =>
          row.txnType === 'deposit' ? (
            <RagBadge tone="green">
              <ArrowUpCircle className="h-3 w-3" />
              Deposit
            </RagBadge>
          ) : (
            <RagBadge tone="red">
              <ArrowDownCircle className="h-3 w-3" />
              Expense
            </RagBadge>
          ),
      },
      {
        key: 'payee',
        label: 'Payee / Account',
        render: (row) => row.payee || row.accountName || '—',
      },
      {
        key: 'description',
        label: 'Description',
        render: (row) => (
          <span
            className="block max-w-xs truncate"
            style={{ color: 'var(--fg-secondary)' }}
            title={row.description ?? ''}
          >
            {row.description || '—'}
          </span>
        ),
      },
      {
        key: 'amount',
        label: 'Amount',
        align: 'right',
        render: (row) => (
          <span
            className="tabular-nums font-medium"
            style={{
              color: row.txnType === 'deposit' ? 'var(--rag-green)' : 'var(--rag-red)',
            }}
          >
            {row.txnType === 'deposit' ? '+' : '−'}
            {formatUSD(row.amount)}
          </span>
        ),
      },
      {
        key: 'currency',
        label: 'Currency',
        width: 100,
        render: (row) => (
          <span style={{ color: 'var(--fg-tertiary)' }}>{row.currency}</span>
        ),
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
            <Banknote
              className="inline-block h-5 w-5 mr-2 -mt-1"
              style={{ color: 'var(--rag-green)' }}
            />
            Bank Transactions
          </h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            QuickBooks Online synced purchases and deposits
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

      {error && <Banner tone="danger" title="Couldn't load transactions" message={error} />}

      {/* KPIs */}
      <KPIGrid cols={3}>
        <KPICard
          label="Total Transactions"
          value={loading ? '—' : transactions.length}
        />
        <KPICard
          label="Total Expenses"
          value={loading ? '—' : formatUSD(totalExpenses)}
          unit="USD"
          delta={loading ? undefined : `${expenses.length} txns`}
          trend="down"
          sparkColor="var(--rag-red)"
        />
        <KPICard
          label="Total Deposits"
          value={loading ? '—' : formatUSD(totalDeposits)}
          unit="USD"
          delta={loading ? undefined : `${deposits.length} txns`}
          trend="up"
          sparkColor="var(--rag-green)"
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
      ) : transactions.length === 0 ? (
        <div
          className="text-center py-12 rounded-[10px] border bg-[var(--bg-surface)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--fg-tertiary)' }}
        >
          <Banknote className="h-9 w-9 mx-auto mb-2 opacity-40" />
          <p className="font-medium text-[14px]" style={{ color: 'var(--fg-primary)' }}>
            No transactions synced yet
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--fg-secondary)' }}>
            Click "Sync Now" to pull bank transactions from QuickBooks
          </p>
        </div>
      ) : (
        <DataTable<QBOBankTransaction>
          data={transactions}
          columns={columns}
          search="Search by payee, description…"
          filters={[
            {
              label: 'Type',
              key: 'txnType',
              options: ['All', 'expense', 'deposit'],
            },
          ]}
        />
      )}
    </div>
  );
}

export default BankTransactionsPage;
