/**
 * Budget Warning Banner
 * Non-blocking warning shown when child requisitions exceed parent funds amount.
 */

import { AlertTriangle, Info } from 'lucide-react';

interface BudgetWarningProps {
  parentAmount: number;
  existingChildTotal: number;
  currentAmount: number;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function BudgetWarningBanner({
  parentAmount,
  existingChildTotal,
  currentAmount,
  currency = 'UGX',
}: BudgetWarningProps) {
  const projectedTotal = existingChildTotal + currentAmount;
  const remaining = parentAmount - projectedTotal;
  const exceeded = projectedTotal > parentAmount;
  const approaching = remaining < parentAmount * 0.1 && !exceeded;

  if (!exceeded && !approaching) return null;

  return (
    <div
      className={`rounded-lg border p-4 ${
        exceeded
          ? 'bg-red-50 border-red-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {exceeded ? (
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        ) : (
          <Info className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1">
          <h4
            className={`text-sm font-semibold ${
              exceeded ? 'text-red-800' : 'text-yellow-800'
            }`}
          >
            {exceeded ? 'Budget Exceeded' : 'Approaching Budget Limit'}
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="text-gray-600">Parent funds amount:</div>
            <div className="font-medium">{formatCurrency(parentAmount, currency)}</div>
            <div className="text-gray-600">Already allocated to children:</div>
            <div className="font-medium">{formatCurrency(existingChildTotal, currency)}</div>
            <div className="text-gray-600">This requisition:</div>
            <div className="font-medium">{formatCurrency(currentAmount, currency)}</div>
            <div className={`font-medium ${exceeded ? 'text-red-700' : 'text-gray-600'}`}>
              {exceeded ? 'Over budget by:' : 'Remaining:'}
            </div>
            <div className={`font-bold ${exceeded ? 'text-red-700' : 'text-yellow-700'}`}>
              {exceeded
                ? formatCurrency(Math.abs(remaining), currency)
                : formatCurrency(remaining, currency)}
            </div>
          </div>
          {exceeded && (
            <p className="mt-2 text-xs text-red-600">
              You can still submit this requisition. The budget warning is for your awareness.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
