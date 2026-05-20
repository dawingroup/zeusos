/**
 * Material Variance Table
 * Sortable, filterable table showing material-level variance data
 */

import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Filter, AlertTriangle } from 'lucide-react';
import type { MaterialVariance, VarianceStatus } from '../../types/variance';

interface MaterialVarianceTableProps {
  materials: MaterialVariance[];
}

type SortField = 'name' | 'fulfillment' | 'costVariance' | 'quantityVariance';
type SortDirection = 'asc' | 'desc';

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toLocaleString();
};

const StatusBadge: React.FC<{ status: VarianceStatus }> = ({ status }) => {
  const config: Record<VarianceStatus, { label: string; className: string }> = {
    'on-track': { label: 'On Track', className: 'bg-green-100 text-green-800' },
    'under-procured': { label: 'Under', className: 'bg-amber-100 text-amber-800' },
    'over-procured': { label: 'Over', className: 'bg-red-100 text-red-800' },
    'cost-overrun': { label: 'Overrun', className: 'bg-red-100 text-red-800' },
    'cost-savings': { label: 'Savings', className: 'bg-green-100 text-green-800' },
    'at-risk': { label: 'At Risk', className: 'bg-red-100 text-red-800' },
  };

  const { label, className } = config[status];
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
};

export const MaterialVarianceTable: React.FC<MaterialVarianceTableProps> = ({ materials }) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('costVariance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<VarianceStatus[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleStatusFilter = (status: VarianceStatus) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...materials];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(m =>
        m.materialInfo.name.toLowerCase().includes(searchLower) ||
        m.materialInfo.category?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (statusFilter.length > 0) {
      result = result.filter(m => statusFilter.includes(m.status));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.materialInfo.name.localeCompare(b.materialInfo.name);
          break;
        case 'fulfillment':
          comparison = a.variance.fulfillmentPercent - b.variance.fulfillmentPercent;
          break;
        case 'costVariance':
          comparison = a.variance.costDelta - b.variance.costDelta;
          break;
        case 'quantityVariance':
          comparison = a.variance.quantityDelta - b.variance.quantityDelta;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [materials, search, statusFilter, sortField, sortDirection]);

  const statusOptions: VarianceStatus[] = [
    'on-track', 'under-procured', 'over-procured', 'cost-overrun', 'cost-savings', 'at-risk'
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search materials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
            statusFilter.length > 0 ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
          }`}
        >
          <Filter className="h-4 w-4" />
          Status
          {statusFilter.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">
              {statusFilter.length}
            </span>
          )}
        </button>
      </div>

      {/* Status filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
          {statusOptions.map(status => (
            <button
              key={status}
              onClick={() => toggleStatusFilter(status)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                statusFilter.includes(status)
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-500'
              }`}
            >
              {status.replace('-', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-700"
                >
                  Material
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Planned
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actual
              </th>
              <th className="px-4 py-3">
                <button
                  onClick={() => handleSort('fulfillment')}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-700"
                >
                  Fulfillment
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  onClick={() => handleSort('costVariance')}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-700"
                >
                  Cost Variance
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No materials found
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(item => (
                <tr key={item.materialId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.alerts.length > 0 && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.materialInfo.name}</p>
                        {item.materialInfo.category && (
                          <p className="text-xs text-gray-500">{item.materialInfo.category}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm">{item.planned.quantity.toFixed(1)} {item.planned.unit}</p>
                    <p className="text-xs text-gray-500">UGX {formatCurrency(item.planned.totalCost)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm">{item.actual.quantityAccepted.toFixed(1)} {item.planned.unit}</p>
                    <p className="text-xs text-gray-500">UGX {formatCurrency(item.actual.totalCost)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-24">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{item.variance.fulfillmentPercent.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            item.variance.fulfillmentPercent >= 100 ? 'bg-green-500' :
                            item.variance.fulfillmentPercent >= 70 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(item.variance.fulfillmentPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={
                      item.variance.costPercent > 0 ? 'text-red-600' :
                      item.variance.costPercent < 0 ? 'text-green-600' : 'text-gray-600'
                    }>
                      {item.variance.costPercent > 0 ? '+' : ''}{item.variance.costPercent.toFixed(1)}%
                      <span className="text-xs text-gray-500 ml-1">
                        ({item.variance.costDelta > 0 ? '+' : ''}UGX {formatCurrency(item.variance.costDelta)})
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">
        Showing {filteredAndSorted.length} of {materials.length} materials
      </p>
    </div>
  );
};

export default MaterialVarianceTable;
