/**
 * Purchase Orders Page
 * List and manage purchase orders for a project
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useProjectPurchaseOrders } from '../hooks/procurement-hooks';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import type { PurchaseOrder } from '../types/procurement';

type FilterTab = 'all' | 'active' | 'pending' | 'completed';

// Status type from the PurchaseOrder model
type POStatus = PurchaseOrder['status'];

const STATUS_ICON_MAP: Record<POStatus, React.ElementType> = {
  draft: FileText,
  submitted: Clock,
  approved: CheckCircle,
  partially_fulfilled: Package,
  fulfilled: Truck,
  cancelled: XCircle,
};

const STATUS_COLOR_MAP: Record<POStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  partially_fulfilled: 'bg-orange-100 text-orange-700',
  fulfilled: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_fulfilled: 'Partial',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
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

const PurchaseOrdersPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { purchaseOrders, loading, error, refetch } = useProjectPurchaseOrders(projectId);

  const filteredOrders = useMemo(() => {
    let result = purchaseOrders;

    switch (filterTab) {
      case 'active':
        result = result.filter(po =>
          ['draft', 'submitted', 'approved', 'partially_fulfilled'].includes(po.status)
        );
        break;
      case 'pending':
        result = result.filter(po => po.status === 'submitted');
        break;
      case 'completed':
        result = result.filter(po => ['fulfilled', 'cancelled'].includes(po.status));
        break;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(po =>
        po.orderNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        po.items.some(item => item.materialName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [purchaseOrders, filterTab, searchQuery]);

  const stats = useMemo(() => {
    const active = purchaseOrders.filter(po =>
      !['fulfilled', 'cancelled'].includes(po.status)
    );
    const pending = purchaseOrders.filter(po => po.status === 'submitted');
    const totalValue = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);

    return {
      total: purchaseOrders.length,
      active: active.length,
      pending: pending.length,
      totalValue,
    };
  }, [purchaseOrders]);

  const handleCreatePO = () => {
    navigate(`/advisory/delivery/projects/${projectId}/purchase-orders/new`);
  };

  const handleViewPO = (poId: string) => {
    navigate(`/advisory/delivery/projects/${projectId}/purchase-orders/${poId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">Failed to load purchase orders</p>
        <button onClick={refetch} className="mt-2 text-sm text-red-600 underline">
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
            <FileText className="h-6 w-6 text-blue-600" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground">
            Manage purchase orders for materials and supplies
          </p>
        </div>
        <button
          onClick={handleCreatePO}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Stats */}
      <KPIGrid cols={4}>
        <KPICard label="Total POs" value={stats.total} />
        <KPICard label="Active" value={stats.active} />
        <KPICard label="Pending Approval" value={stats.pending} />
        <KPICard label="Total Value" value={formatCurrency(stats.totalValue)} />
      </KPIGrid>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            {(['all', 'active', 'pending', 'completed'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
                  filterTab === tab
                    ? 'bg-blue-100 text-blue-700 font-medium'
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
              placeholder="Search POs..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {filteredOrders.length} purchase order{filteredOrders.length !== 1 ? 's' : ''}
      </div>

      {/* PO List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No purchase orders found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery || filterTab !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first purchase order to get started'}
          </p>
          {!searchQuery && filterTab === 'all' && (
            <button
              onClick={handleCreatePO}
              className="mt-4 text-blue-600 hover:underline"
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
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">PO Number</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Supplier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Items</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Total</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(po => {
                const StatusIcon = STATUS_ICON_MAP[po.status];

                return (
                  <tr
                    key={po.id}
                    onClick={() => handleViewPO(po.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-blue-600">{po.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{po.supplierName}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
                        STATUS_COLOR_MAP[po.status]
                      )}>
                        <StatusIcon className="h-3 w-3" />
                        {STATUS_LABELS[po.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {po.items.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(po.createdAt)}
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

export default PurchaseOrdersPage;
