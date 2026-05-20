/**
 * Valuation History
 * 
 * Displays NAV history and valuation changes over time.
 */

import { Plus, TrendingUp, TrendingDown } from 'lucide-react';

interface Valuation {
  id: string;
  date: Date;
  nav: number;
  previousNav: number;
  change: number;
  changePercent: number;
  method: string;
  source: string;
}

interface ValuationHistoryProps {
  holdingId?: string;
  valuations?: Valuation[];
  loading?: boolean;
  onAddValuation?: () => void;
}

export function ValuationHistory({
  holdingId: _holdingId,
  valuations = [],
  loading = false,
  onAddValuation,
}: ValuationHistoryProps) {
  // Mock valuations if none provided
  const mockValuations: Valuation[] = valuations.length > 0 ? valuations : [
    {
      id: '1',
      date: new Date('2024-12-31'),
      nav: 8500000,
      previousNav: 8200000,
      change: 300000,
      changePercent: 0.0366,
      method: 'DCF',
      source: 'Internal',
    },
    {
      id: '2',
      date: new Date('2024-09-30'),
      nav: 8200000,
      previousNav: 7800000,
      change: 400000,
      changePercent: 0.0513,
      method: 'DCF',
      source: 'Internal',
    },
    {
      id: '3',
      date: new Date('2024-06-30'),
      nav: 7800000,
      previousNav: 7500000,
      change: 300000,
      changePercent: 0.04,
      method: 'DCF',
      source: 'Internal',
    },
    {
      id: '4',
      date: new Date('2024-03-31'),
      nav: 7500000,
      previousNav: 7500000,
      change: 0,
      changePercent: 0,
      method: 'Cost',
      source: 'Initial',
    },
  ];
  
  const currentNav = mockValuations[0]?.nav || 0;
  const initialNav = mockValuations[mockValuations.length - 1]?.nav || 0;
  const totalChange = currentNav - initialNav;
  const totalChangePercent = initialNav > 0 ? totalChange / initialNav : 0;
  
  if (loading) {
    return <ValuationHistorySkeleton />;
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Valuation History</h3>
        
        {onAddValuation && (
          <button
            onClick={onAddValuation}
            className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Update Valuation
          </button>
        )}
      </div>
      
      {/* Current Value Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">Current NAV</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentNav)}</p>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">Total Change</p>
          <div className={`flex items-center gap-1 ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalChange >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            <span className="text-2xl font-bold">{formatCurrency(Math.abs(totalChange))}</span>
          </div>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <p className="text-sm text-gray-500">Total Return</p>
          <p className={`text-2xl font-bold ${totalChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalChangePercent >= 0 ? '+' : ''}{formatPercent(totalChangePercent)}
          </p>
        </div>
      </div>
      
      {/* Chart Placeholder */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>NAV Chart Placeholder</p>
          </div>
        </div>
      </div>
      
      {/* Valuation Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                NAV
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Change
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                % Change
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mockValuations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No valuations recorded
                </td>
              </tr>
            ) : (
              mockValuations.map((valuation) => (
                <tr key={valuation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatDate(valuation.date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                    {formatCurrency(valuation.nav)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <span
                      className={
                        valuation.change > 0
                          ? 'text-green-600'
                          : valuation.change < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                      }
                    >
                      {valuation.change > 0 ? '+' : ''}
                      {formatCurrency(valuation.change)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <span
                      className={
                        valuation.changePercent > 0
                          ? 'text-green-600'
                          : valuation.changePercent < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                      }
                    >
                      {valuation.changePercent > 0 ? '+' : ''}
                      {formatPercent(valuation.changePercent)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {valuation.method}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {valuation.source}
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

function ValuationHistorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-gray-200 rounded-lg" />
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default ValuationHistory;
