/**
 * Holdings Table
 * 
 * Displays portfolio holdings in a sortable, filterable table.
 */

import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, MoreHorizontal, TrendingUp, TrendingDown } from 'lucide-react';

interface Holding {
  id: string;
  name: string;
  type: string;
  value: number;
  irr: number;
  moic: number;
  sector: string;
  vintage: number;
  status: string;
}

interface HoldingsTableProps {
  holdings: Holding[];
  loading?: boolean;
  compact?: boolean;
  onHoldingClick?: (holdingId: string) => void;
}

type SortField = 'name' | 'value' | 'irr' | 'moic' | 'vintage';
type SortDirection = 'asc' | 'desc';

export function HoldingsTable({
  holdings,
  loading = false,
  compact = false,
  onHoldingClick,
}: HoldingsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const filteredHoldings = useMemo(() => {
    let result = [...holdings];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.name.toLowerCase().includes(query) ||
          h.type.toLowerCase().includes(query) ||
          h.sector.toLowerCase().includes(query)
      );
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'irr':
          comparison = a.irr - b.irr;
          break;
        case 'moic':
          comparison = a.moic - b.moic;
          break;
        case 'vintage':
          comparison = a.vintage - b.vintage;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [holdings, searchQuery, sortField, sortDirection]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  if (loading) {
    return <HoldingsTableSkeleton />;
  }
  
  return (
    <div className="space-y-4">
      {/* Search */}
      {!compact && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search holdings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      )}
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-sticky-first-col">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('vintage')}
              >
                <div className="flex items-center gap-1">
                  Vintage
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('value')}
              >
                <div className="flex items-center justify-end gap-1">
                  Value
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('irr')}
              >
                <div className="flex items-center justify-end gap-1">
                  IRR
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('moic')}
              >
                <div className="flex items-center justify-end gap-1">
                  MOIC
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              {!compact && <th className="px-4 py-3 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredHoldings.length === 0 ? (
              <tr>
                <td colSpan={compact ? 7 : 8} className="px-4 py-8 text-center text-gray-500">
                  No holdings found
                </td>
              </tr>
            ) : (
              filteredHoldings.map((holding) => (
                <tr
                  key={holding.id}
                  onClick={() => onHoldingClick?.(holding.id)}
                  className={onHoldingClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{holding.name}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                      {holding.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {holding.vintage}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                    {formatCurrency(holding.value)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <div className={`flex items-center justify-end gap-1 ${
                      holding.irr >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {holding.irr >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {formatPercent(holding.irr)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    {holding.moic.toFixed(2)}x
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={holding.status} />
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Menu action
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      {!compact && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {filteredHoldings.length} of {holdings.length} holdings
          </span>
          <span>
            Total Value: {formatCurrency(filteredHoldings.reduce((sum, h) => sum + h.value, 0))}
          </span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    committed: 'bg-blue-100 text-blue-800',
    invested: 'bg-green-100 text-green-800',
    realized: 'bg-gray-100 text-gray-800',
    written_off: 'bg-red-100 text-red-800',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function HoldingsTableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/3" />
      <div className="border rounded-lg overflow-hidden">
        <div className="h-12 bg-gray-100" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 border-t bg-gray-50" />
        ))}
      </div>
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

export default HoldingsTable;
