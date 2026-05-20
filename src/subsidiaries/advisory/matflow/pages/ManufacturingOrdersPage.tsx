/**
 * Manufacturing Orders Page
 * List and manage manufacturing/production work orders for a project
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Factory,
  Plus,
  Search,
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { getManufacturingOrders } from '../services/manufacturing-service';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import type { ManufacturingOrder, ManufacturingOrderStatus } from '../types/manufacturing';
import { MO_STATUS_CONFIG, MO_PRIORITY_CONFIG } from '../types/manufacturing';

type FilterTab = 'all' | 'active' | 'planned' | 'completed';

const STATUS_ICON_MAP: Partial<Record<ManufacturingOrderStatus, React.ElementType>> = {
  draft: Clock,
  planned: Clock,
  in_progress: PlayCircle,
  on_hold: PauseCircle,
  quality_check: AlertTriangle,
  completed: CheckCircle,
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (timestamp: any): string => {
  if (!timestamp) return '-';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const ManufacturingOrdersPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getManufacturingOrders(projectId);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    switch (filterTab) {
      case 'active':
        result = result.filter(mo =>
          ['draft', 'planned', 'in_progress', 'on_hold', 'quality_check'].includes(mo.status)
        );
        break;
      case 'planned':
        result = result.filter(mo => mo.status === 'planned');
        break;
      case 'completed':
        result = result.filter(mo => ['completed', 'cancelled'].includes(mo.status));
        break;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(mo =>
        mo.orderNumber.toLowerCase().includes(q) ||
        mo.productName.toLowerCase().includes(q) ||
        (mo.workCenter || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, filterTab, searchQuery]);

  const stats = useMemo(() => {
    const active = orders.filter(mo =>
      !['completed', 'cancelled'].includes(mo.status)
    );
    const inProgress = orders.filter(mo => mo.status === 'in_progress');
    const totalCost = orders.reduce((sum, mo) => sum + mo.estimatedCost, 0);

    return {
      total: orders.length,
      active: active.length,
      inProgress: inProgress.length,
      totalCost,
    };
  }, [orders]);

  const handleCreate = () => {
    navigate(`/advisory/delivery/projects/${projectId}/manufacturing/new`);
  };

  const handleView = (moId: string) => {
    navigate(`/advisory/delivery/projects/${projectId}/manufacturing/${moId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">Failed to load manufacturing orders</p>
        <button onClick={fetchOrders} className="mt-2 text-sm text-red-600 underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-amber-600" />
            Manufacturing Orders
          </h1>
          <p className="text-muted-foreground">
            Track production work orders and material consumption
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Stats */}
      <KPIGrid cols={4}>
        <KPICard label="Total Orders" value={stats.total} />
        <KPICard label="Active" value={stats.active} />
        <KPICard label="In Progress" value={stats.inProgress} />
        <KPICard label="Est. Total Cost" value={formatCurrency(stats.totalCost)} />
      </KPIGrid>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            {(['all', 'active', 'planned', 'completed'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
                  filterTab === tab
                    ? 'bg-amber-100 text-amber-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
      </div>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No manufacturing orders found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery || filterTab !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first manufacturing order to get started'}
          </p>
          {!searchQuery && filterTab === 'all' && (
            <button
              onClick={handleCreate}
              className="mt-4 text-amber-600 hover:underline"
            >
              Create Order
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Order #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Product</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Priority</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Qty</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Est. Cost</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(mo => {
                const statusConfig = MO_STATUS_CONFIG[mo.status];
                const priorityConfig = MO_PRIORITY_CONFIG[mo.priority];
                const StatusIcon = STATUS_ICON_MAP[mo.status] || Clock;
                const progress = mo.quantity > 0 ? Math.round((mo.completedQuantity / mo.quantity) * 100) : 0;

                return (
                  <tr
                    key={mo.id}
                    onClick={() => handleView(mo.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-amber-600">{mo.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{mo.productName}</div>
                      {mo.workCenter && (
                        <div className="text-xs text-gray-500">{mo.workCenter}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
                        statusConfig.color
                      )}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </span>
                      {mo.status === 'in_progress' && (
                        <div className="mt-1 w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                        priorityConfig.color
                      )}>
                        {priorityConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {mo.completedQuantity}/{mo.quantity} {mo.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(mo.estimatedCost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(mo.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManufacturingOrdersPage;
