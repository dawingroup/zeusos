// ============================================================================
// QBO CONNECTION CARD
// ZeusOS v2.0 - Financial Management Module
// QuickBooks Online connection status, sync controls, and data summary
// ============================================================================

import { useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Link2,
  Clock,
  FileText,
  Receipt,
  Landmark,
  CreditCard,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  QBOConnectionStatus,
  QBOSyncJob,
  QBODataCategory,
} from '../../types/integrations.types';
import { QBO_DATA_CATEGORIES } from '../../constants/integrations.constants';

interface QBOConnectionCardProps {
  connection: QBOConnectionStatus | null;
  connectionLoading: boolean;
  syncing: boolean;
  syncJobs: QBOSyncJob[];
  onConnect: () => void;
  onSyncAll: () => void;
  onSyncCategory: (category: QBODataCategory) => void;
  onViewData: () => void;
  // Synced data counts
  accountCount: number;
  invoiceCount: number;
  billCount: number;
  transactionCount: number;
  hasProfitAndLoss: boolean;
  hasBalanceSheet: boolean;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  profit_and_loss: BarChart3,
  balance_sheet: FileText,
  accounts: Landmark,
  invoices: Receipt,
  bills: CreditCard,
  bank_transactions: Landmark,
  customers: FileText,
  vendors: FileText,
};

function formatTimestamp(ts: any): string {
  if (!ts) return 'Never';
  const date = ts?.toDate?.() || new Date(ts?.seconds ? ts.seconds * 1000 : ts);
  return date.toLocaleString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function QBOConnectionCard({
  connection,
  connectionLoading,
  syncing,
  syncJobs,
  onConnect,
  onSyncAll,
  onSyncCategory,
  onViewData,
  accountCount,
  invoiceCount,
  billCount,
  transactionCount,
  hasProfitAndLoss,
  hasBalanceSheet,
}: QBOConnectionCardProps) {
  const [showCategories, setShowCategories] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isConnected = connection?.connected;

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-gradient-to-r $1-[var(--rag-green-soft)] $1-[var(--rag-green-soft)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--rag-green)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">QB</span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">QuickBooks Online</h3>
              <p className="text-xs text-muted-foreground">Accounting & Financial Data</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connectionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--fg-tertiary)]" />
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--rag-green-soft)] text-[var(--rag-green)]">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-sunken)] text-muted-foreground">
                <XCircle className="w-3 h-3" />
                Not Connected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {!isConnected ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Connect QuickBooks Online to sync financial data, invoices, and bank transactions.
            </p>
            <button
              onClick={onConnect}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--rag-green)] text-white text-sm rounded-lg hover:bg-[var(--rag-green)] transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect QuickBooks
            </button>
          </div>
        ) : (
          <>
            {/* Connection Info */}
            {connection?.realmId && (
              <div className="text-xs text-muted-foreground">
                Company ID: {connection.realmId}
                {connection.lastSyncAt && (
                  <span className="ml-3">
                    Last sync: {formatTimestamp(connection.lastSyncAt)}
                  </span>
                )}
              </div>
            )}

            {/* Sync Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={onSyncAll}
                disabled={syncing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--rag-green)] text-white text-sm rounded-lg hover:bg-[var(--rag-green)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {syncing ? 'Syncing...' : 'Sync All Data'}
              </button>
              <button
                onClick={() => setShowCategories(!showCategories)}
                className="px-3 py-2.5 border rounded-lg text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
              >
                {showCategories ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Category-by-Category Sync */}
            {showCategories && (
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(QBO_DATA_CATEGORIES) as [QBODataCategory, string][]).map(
                  ([key, label]) => {
                    const Icon = CATEGORY_ICONS[key] || FileText;
                    return (
                      <button
                        key={key}
                        onClick={() => onSyncCategory(key)}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] disabled:opacity-50 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-[var(--fg-tertiary)]" />
                        {label}
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {/* Data Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[var(--bg-sunken)] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">{accountCount}</p>
                <p className="text-[10px] text-muted-foreground">Accounts</p>
              </div>
              <div className="bg-[var(--bg-sunken)] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">{invoiceCount}</p>
                <p className="text-[10px] text-muted-foreground">Invoices</p>
              </div>
              <div className="bg-[var(--bg-sunken)] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">{billCount}</p>
                <p className="text-[10px] text-muted-foreground">Bills</p>
              </div>
              <div className="bg-[var(--bg-sunken)] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">{transactionCount}</p>
                <p className="text-[10px] text-muted-foreground">Transactions</p>
              </div>
              <div className="bg-[var(--bg-sunken)] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">
                  {hasProfitAndLoss ? '✓' : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground">P&L</p>
              </div>
              <div className="bg-[var(--bg-sunken)] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">
                  {hasBalanceSheet ? '✓' : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground">Balance Sheet</p>
              </div>
            </div>

            {/* View Data Button */}
            <button
              onClick={onViewData}
              className="w-full flex items-center justify-center gap-2 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              View Synced Data
            </button>

            {/* Sync History */}
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground"
              >
                <Clock className="w-3 h-3" />
                Sync History
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showHistory && syncJobs.length > 0 && (
                <div className="mt-2 space-y-1">
                  {syncJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between text-xs text-muted-foreground py-1"
                    >
                      <span>
                        {QBO_DATA_CATEGORIES[job.category] || job.category}
                      </span>
                      <span className="flex items-center gap-1">
                        {job.status === 'success' && (
                          <CheckCircle2 className="w-3 h-3 text-[var(--rag-green)]" />
                        )}
                        {job.status === 'error' && (
                          <XCircle className="w-3 h-3 text-[var(--rag-red)]" />
                        )}
                        {job.status === 'syncing' && (
                          <Loader2 className="w-3 h-3 animate-spin text-[var(--rag-blue)]" />
                        )}
                        {job.recordCount !== undefined && `${job.recordCount} records`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default QBOConnectionCard;
