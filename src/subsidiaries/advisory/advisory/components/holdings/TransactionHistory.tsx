/**
 * Transaction History
 * 
 * Displays capital calls, distributions, and other transactions.
 */

import { useState } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

type TransactionType = 'capital_call' | 'distribution' | 'fee' | 'adjustment';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: Date;
  description: string;
  reference?: string;
}

interface TransactionHistoryProps {
  holdingId?: string;
  portfolioId?: string;
  transactions?: Transaction[];
  loading?: boolean;
  onAddTransaction?: () => void;
}

export function TransactionHistory({
  holdingId: _holdingId,
  portfolioId: _portfolioId,
  transactions = [],
  loading = false,
  onAddTransaction,
}: TransactionHistoryProps) {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  
  // Mock transactions if none provided
  const mockTransactions: Transaction[] = transactions.length > 0 ? transactions : [
    {
      id: '1',
      type: 'capital_call',
      amount: 5000000,
      date: new Date('2024-01-15'),
      description: 'Initial capital call',
      reference: 'CC-001',
    },
    {
      id: '2',
      type: 'capital_call',
      amount: 2500000,
      date: new Date('2024-06-01'),
      description: 'Second capital call',
      reference: 'CC-002',
    },
    {
      id: '3',
      type: 'distribution',
      amount: 1000000,
      date: new Date('2024-09-15'),
      description: 'Dividend distribution',
      reference: 'DIST-001',
    },
    {
      id: '4',
      type: 'fee',
      amount: 75000,
      date: new Date('2024-12-31'),
      description: 'Management fee',
      reference: 'FEE-001',
    },
  ];
  
  const filteredTransactions = typeFilter === 'all'
    ? mockTransactions
    : mockTransactions.filter((t) => t.type === typeFilter);
  
  const totals = mockTransactions.reduce(
    (acc, t) => {
      if (t.type === 'capital_call') {
        acc.calls += t.amount;
      } else if (t.type === 'distribution') {
        acc.distributions += t.amount;
      }
      return acc;
    },
    { calls: 0, distributions: 0 }
  );
  
  if (loading) {
    return <TransactionHistorySkeleton />;
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Types</option>
            <option value="capital_call">Capital Calls</option>
            <option value="distribution">Distributions</option>
            <option value="fee">Fees</option>
            <option value="adjustment">Adjustments</option>
          </select>
        </div>
        
        {onAddTransaction && (
          <button
            onClick={onAddTransaction}
            className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Transaction
          </button>
        )}
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">Total Calls</span>
          </div>
          <p className="text-xl font-bold text-red-900">{formatCurrency(totals.calls)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">Total Distributions</span>
          </div>
          <p className="text-xl font-bold text-green-900">{formatCurrency(totals.distributions)}</p>
        </div>
      </div>
      
      {/* Transaction List */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Reference
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge type={transaction.type} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                    <span
                      className={
                        transaction.type === 'distribution'
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }
                    >
                      {transaction.type === 'distribution' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {transaction.reference || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: TransactionType }) {
  const config: Record<TransactionType, { label: string; color: string }> = {
    capital_call: { label: 'Capital Call', color: 'bg-red-100 text-red-800' },
    distribution: { label: 'Distribution', color: 'bg-green-100 text-green-800' },
    fee: { label: 'Fee', color: 'bg-yellow-100 text-yellow-800' },
    adjustment: { label: 'Adjustment', color: 'bg-gray-100 text-gray-800' },
  };
  
  const { label, color } = config[type];
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>
      {label}
    </span>
  );
}

function TransactionHistorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 bg-gray-200 rounded-lg" />
        <div className="h-20 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default TransactionHistory;
