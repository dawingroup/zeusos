// ============================================================================
// CASH TRANSACTION LIST
// ZeusOS v2.0 - Financial Management Module
// List and filter cash transactions
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Search,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CashTransaction, CashFlowFilters } from '../../types/cashflow.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import {
  CASH_FLOW_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CashTransactionListProps {
  transactions: CashTransaction[];
  onView?: (transaction: CashTransaction) => void;
  onEdit?: (transaction: CashTransaction) => void;
  onDelete?: (transaction: CashTransaction) => void;
  filters?: CashFlowFilters;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const CashTransactionList: React.FC<CashTransactionListProps> = ({
  transactions,
  onView,
  onEdit,
  onDelete,
  filters = {},
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm || '');
  const [typeFilter, setTypeFilter] = useState<string>(filters.type || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        t => t.description.toLowerCase().includes(term) ||
             t.reference?.toLowerCase().includes(term) ||
             t.customerName?.toLowerCase().includes(term) ||
             t.supplierName?.toLowerCase().includes(term)
      );
    }

    if (typeFilter) {
      result = result.filter(t => t.type === typeFilter);
    }

    if (categoryFilter) {
      result = result.filter(t => t.category === categoryFilter);
    }

    return result;
  }, [transactions, searchTerm, typeFilter, categoryFilter]);

  // Paginated transactions
  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Calculate totals
  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'inflow') {
          acc.inflows += tx.amount;
        } else {
          acc.outflows += tx.amount;
        }
        return acc;
      },
      { inflows: 0, outflows: 0 }
    );
  }, [filteredTransactions]);

  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);

  return (
    <div className="bg-card rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <h3 className="font-semibold text-foreground">Cash Transactions</h3>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-tertiary)]" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C]"
          >
            <option value="">All Types</option>
            <option value="inflow">Inflows</option>
            <option value="outflow">Outflows</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C]"
          >
            <option value="">All Categories</option>
            {Object.entries(CASH_FLOW_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Summary */}
        <div className="flex gap-3 mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--rag-green-soft)] text-[var(--rag-green)] rounded-full text-sm border border-[var(--rag-green)]">
            <TrendingUp className="w-3.5 h-3.5" />
            Inflows: {formatCurrency(totals.inflows, 'UGX' as CurrencyCode)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded-full text-sm border border-[var(--rag-red)]">
            <TrendingDown className="w-3.5 h-3.5" />
            Outflows: {formatCurrency(totals.outflows, 'UGX' as CurrencyCode)}
          </span>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
            totals.inflows >= totals.outflows
              ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]'
              : 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
          }`}>
            Net: {formatCurrency(totals.inflows - totals.outflows, 'UGX' as CurrencyCode)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-sunken)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Reconciled</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {paginatedTransactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-[var(--bg-sunken)]">
                <td className="px-4 py-3 text-foreground">
                  {tx.date.toLocaleDateString('en-UG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{tx.description}</div>
                  {tx.reference && (
                    <div className="text-xs text-muted-foreground">Ref: {tx.reference}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-1 bg-[var(--bg-sunken)] text-muted-foreground rounded text-xs">
                    {CASH_FLOW_CATEGORY_LABELS[tx.category]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono font-medium ${
                    tx.type === 'inflow' ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
                  }`}>
                    {tx.type === 'inflow' ? '+' : '-'}
                    {formatCurrency(tx.amount, tx.currency as CurrencyCode)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {tx.isReconciled ? (
                    <CheckCircle className="w-5 h-5 text-[var(--rag-green)] mx-auto" />
                  ) : (
                    <Circle className="w-5 h-5 text-[var(--fg-tertiary)] mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === tx.id ? null : tx.id)}
                    className="p-1 hover:bg-[var(--bg-sunken)] rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen === tx.id && (
                    <div className="absolute right-4 top-full mt-1 w-40 bg-card border border-[var(--border-subtle)] rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => { onView?.(tx); setMenuOpen(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      <button
                        onClick={() => { onEdit?.(tx); setMenuOpen(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => { onDelete?.(tx); setMenuOpen(null); }}
                        disabled={tx.isReconciled}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--rag-red)] hover:bg-[var(--rag-red-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {paginatedTransactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            className="px-2 py-1 border border-[var(--border-default)] rounded text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1 hover:bg-[var(--bg-sunken)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 hover:bg-[var(--bg-sunken)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashTransactionList;
