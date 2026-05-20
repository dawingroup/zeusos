// ============================================================================
// QBO CONNECTION CARD
// DawinOS v2.0 - Financial Management Module
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
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">QB</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">QuickBooks Online</h3>
              <p className="text-xs text-gray-500">Accounting & Financial Data</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connectionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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
            <p className="text-sm text-gray-500 mb-3">
              Connect QuickBooks Online to sync financial data, invoices, and bank transactions.
            </p>
            <button
              onClick={onConnect}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect QuickBooks
            </button>
          </div>
        ) : (
          <>
            {/* Connection Info */}
            {connection?.realmId && (
              <div className="text-xs text-gray-500">
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="px-3 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
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
                        className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                        {label}
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {/* Data Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">{accountCount}</p>
                <p className="text-[10px] text-gray-500">Accounts</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">{invoiceCount}</p>
                <p className="text-[10px] text-gray-500">Invoices</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">{billCount}</p>
                <p className="text-[10px] text-gray-500">Bills</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">{transactionCount}</p>
                <p className="text-[10px] text-gray-500">Transactions</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">
                  {hasProfitAndLoss ? '✓' : '—'}
                </p>
                <p className="text-[10px] text-gray-500">P&L</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">
                  {hasBalanceSheet ? '✓' : '—'}
                </p>
                <p className="text-[10px] text-gray-500">Balance Sheet</p>
              </div>
            </div>

            {/* View Data Button */}
            <button
              onClick={onViewData}
              className="w-full flex items-center justify-center gap-2 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              View Synced Data
            </button>

            {/* Sync History */}
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
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
                      className="flex items-center justify-between text-xs text-gray-500 py-1"
                    >
                      <span>
                        {QBO_DATA_CATEGORIES[job.category] || job.category}
                      </span>
                      <span className="flex items-center gap-1">
                        {job.status === 'success' && (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        )}
                        {job.status === 'error' && (
                          <XCircle className="w-3 h-3 text-red-500" />
                        )}
                        {job.status === 'syncing' && (
                          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
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
