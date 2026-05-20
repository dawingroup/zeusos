/**
 * IncomingJobsSection
 * Displays design items approaching manufacturing that haven't been handed over yet.
 * Shown with greyed-out/muted styling to distinguish from actual MOs.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Info, Package, RefreshCw } from 'lucide-react';
import { useIncomingManufacturingItems } from '@/modules/crm/hooks/useIncomingManufacturingItems';

const RAG_COLORS: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  'not-applicable': 'bg-gray-300',
};

function formatStageName(stage: string): string {
  return stage
    .replace(/^(procure-|arch-|const-)/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatCurrency(value: number): string {
  if (value === 0) return '-';
  return `UGX ${value.toLocaleString()}`;
}

export function IncomingJobsSection() {
  const navigate = useNavigate();
  const { items, loading, refetch } = useIncomingManufacturingItems();
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (loading) return null;
  if (items.length === 0) return null;

  const productionReadyCount = items.filter((i) => i.currentStage === 'production-ready').length;
  const preProductionCount = items.filter((i) => i.currentStage === 'pre-production').length;
  const earlierCount = items.length - productionReadyCount - preProductionCount;

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-dashed border-gray-300 overflow-hidden opacity-70">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <Package className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Incoming Jobs ({items.length})
          </span>
          <div className="relative group">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
              Design items approaching manufacturing — not yet handed over. These items give you advance notice of upcoming jobs.
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <span className="text-xs text-gray-400">Pre-handover items</span>
      </button>

      {/* Stage Summary + Table */}
      {isExpanded && (
        <>
          {/* Stage summary bar */}
          <div className="px-6 py-2 border-b bg-gray-50/50 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Production Ready: {productionReadyCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              Pre-Production: {preProductionCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
              Earlier Stages: {earlierCount}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-2.5 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    RAG
                  </th>
                  <th className="px-6 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Readiness
                  </th>
                  <th className="px-6 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Est. Cost
                  </th>
                  <th className="px-6 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr
                    key={item.designItemId}
                    onClick={() => navigate(`/crm/projects/${item.projectId}`)}
                    className="text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium text-gray-600">{item.designItemName}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {item.projectCode}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {item.customerName}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        item.currentStage === 'production-ready'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {formatStageName(item.currentStage)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${RAG_COLORS[item.ragStatus] || RAG_COLORS['not-applicable']}`}
                      />
                    </td>
                    <td className="px-6 py-3 text-right text-sm">
                      {item.overallReadiness}%
                    </td>
                    <td className="px-6 py-3 text-right text-sm">
                      {formatCurrency(item.estimatedCosts.totalCost)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {item.currentStage === 'production-ready' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/design/project/${item.projectId}/item/${item.designItemId}`);
                          }}
                          className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          Review for Handover
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Not ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
