/**
 * FinancialReconciliation - Visual breakdown of requisition vs accountability amounts
 */

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Accountability, AccountabilityExpense } from '../../types/accountability';

interface FinancialReconciliationProps {
  requisitionAmount: number;
  accountability?: Accountability;
  expenses?: AccountabilityExpense[];
  totalExpenses?: number;
  unspentReturned?: number;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function FinancialReconciliation({
  requisitionAmount,
  accountability,
  expenses,
  totalExpenses: propTotalExpenses,
  unspentReturned: propUnspentReturned,
  currency = 'UGX',
}: FinancialReconciliationProps) {
  // Use props or derive from accountability
  const expenseList = expenses || accountability?.expenses || [];
  const totalExpenses = propTotalExpenses ?? accountability?.totalExpenses ?? 0;
  const unspentReturned = propUnspentReturned ?? accountability?.unspentReturned ?? 0;

  const totalAccounted = totalExpenses + unspentReturned;
  const balance = requisitionAmount - totalAccounted;
  const isReconciled = Math.abs(balance) < 1;
  const isOver = balance < 0;

  // Group expenses by category
  const expensesByCategory = expenseList.reduce((acc, expense) => {
    const category = expense.category || 'other';
    if (!acc[category]) {
      acc[category] = { amount: 0, count: 0, verified: 0 };
    }
    acc[category].amount += expense.amount;
    acc[category].count++;
    if (expense.status === 'verified') {
      acc[category].verified++;
    }
    return acc;
  }, {} as Record<string, { amount: number; count: number; verified: number }>);

  const categoryLabels: Record<string, string> = {
    construction_materials: 'Construction Materials',
    labor: 'Labor',
    equipment: 'Equipment',
    transport: 'Transport',
    utilities: 'Utilities',
    permits: 'Permits & Fees',
    professional_services: 'Professional Services',
    contingency: 'Contingency',
    other: 'Other',
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">Financial Reconciliation</h3>
      </div>

      <div className="p-4">
        {/* Main amounts */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-700 font-medium">Requisition Amount</span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(requisitionAmount, currency)}
            </span>
          </div>

          {/* Expense breakdown by category */}
          <div className="py-2">
            <div className="text-sm font-medium text-gray-700 mb-2">Expenses by Category</div>
            <div className="space-y-2">
              {Object.entries(expensesByCategory).map(([category, data]) => {
                const percentage = (data.amount / requisitionAmount) * 100;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {categoryLabels[category] || category}
                          <span className="text-gray-400 ml-1">({data.count})</span>
                        </span>
                        <span className="font-medium">
                          {formatCurrency(data.amount, currency)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Expenses</span>
              <span className="font-medium text-green-600">
                {formatCurrency(totalExpenses, currency)}
              </span>
            </div>

            {unspentReturned > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Unspent Returned</span>
                <span className="font-medium text-blue-600">
                  {formatCurrency(unspentReturned, currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="font-medium text-gray-700">Total Accounted</span>
              <span className="font-bold text-gray-900">
                {formatCurrency(totalAccounted, currency)}
              </span>
            </div>
          </div>

          {/* Balance */}
          <div
            className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
              isReconciled
                ? 'bg-green-50 border border-green-200'
                : isOver
                ? 'bg-red-50 border border-red-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {isReconciled ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">Fully Reconciled</span>
                </>
              ) : isOver ? (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-700">Over Budget</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-700">Balance Remaining</span>
                </>
              )}
            </div>
            <span
              className={`text-xl font-bold ${
                isReconciled
                  ? 'text-green-700'
                  : isOver
                  ? 'text-red-700'
                  : 'text-amber-700'
              }`}
            >
              {isReconciled
                ? formatCurrency(0, currency)
                : isOver
                ? `+${formatCurrency(Math.abs(balance), currency)}`
                : formatCurrency(balance, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReconciliationProgressProps {
  requisitionAmount: number;
  totalAccounted: number;
  currency?: string;
  showLabel?: boolean;
}

export function ReconciliationProgress({
  requisitionAmount,
  totalAccounted,
  currency = 'UGX',
  showLabel = true,
}: ReconciliationProgressProps) {
  const percentage = requisitionAmount > 0 ? (totalAccounted / requisitionAmount) * 100 : 0;
  const isComplete = percentage >= 100;

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Accountability Progress</span>
          <span className="font-medium">
            {formatCurrency(totalAccounted, currency)} / {formatCurrency(requisitionAmount, currency)}
          </span>
        </div>
      )}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isComplete ? 'bg-green-500' : percentage >= 70 ? 'bg-blue-500' : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-gray-500">{percentage.toFixed(0)}% accounted</span>
        {!isComplete && (
          <span className="text-amber-600">
            {formatCurrency(requisitionAmount - totalAccounted, currency)} remaining
          </span>
        )}
      </div>
    </div>
  );
}
