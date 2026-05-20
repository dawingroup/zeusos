/**
 * PO FULFILLMENT DASHBOARD
 *
 * Dashboard to monitor purchase order fulfillment status.
 * Features:
 * - List all POs with delivery progress
 * - Filter by status, supplier, project
 * - Progress bars for each item
 * - Quick actions (record delivery, view details)
 * - Real-time fulfillment tracking
 */

import React, { useState, useEffect } from 'react';
import { procurementService } from '../../services/procurement-service';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/procurement';

// ============================================================================
// TYPES
// ============================================================================

type POStatusFilter = 'all' | 'approved' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';

interface POFulfillmentDashboardProps {
  projectId?: string;
  onRecordDelivery?: (poId: string, itemId: string) => void;
  onViewPODetails?: (poId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const POFulfillmentDashboard: React.FC<POFulfillmentDashboardProps> = ({
  projectId,
  onRecordDelivery,
  onViewPODetails
}) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedPOId, setExpandedPOId] = useState<string | null>(null);

  // Load purchase orders
  useEffect(() => {
    loadPurchaseOrders();
  }, [projectId]);

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [purchaseOrders, statusFilter, searchQuery]);

  /**
   * Load purchase orders
   */
  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      let pos: PurchaseOrder[];

      if (projectId) {
        pos = await procurementService.getPurchaseOrdersByProject(projectId);
      } else {
        // Load all POs (would need to implement this method)
        pos = []; // Placeholder
      }

      setPurchaseOrders(pos);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply filters to POs
   */
  const applyFilters = () => {
    let filtered = [...purchaseOrders];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(po => po.status === statusFilter);
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(po =>
        po.orderNumber.toLowerCase().includes(query) ||
        po.supplierName.toLowerCase().includes(query) ||
        po.items.some(item => item.materialName.toLowerCase().includes(query))
      );
    }

    setFilteredPOs(filtered);
  };

  /**
   * Calculate overall PO fulfillment percentage
   */
  const calculatePOFulfillment = (po: PurchaseOrder): number => {
    if (po.items.length === 0) return 0;

    const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalDelivered = po.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);

    if (totalOrdered === 0) return 0;
    return (totalDelivered / totalOrdered) * 100;
  };

  /**
   * Calculate item fulfillment percentage
   */
  const calculateItemFulfillment = (item: PurchaseOrderItem): number => {
    if (item.quantity === 0) return 0;
    return ((item.deliveredQuantity || 0) / item.quantity) * 100;
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'partially_fulfilled':
        return 'bg-yellow-100 text-yellow-800';
      case 'fulfilled':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount: number, currency: string = 'UGX'): string => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  /**
   * Toggle PO expansion
   */
  const togglePOExpansion = (poId: string) => {
    setExpandedPOId(expandedPOId === poId ? null : poId);
  };

  /**
   * Get fulfillment statistics
   */
  const getStatistics = () => {
    const total = purchaseOrders.length;
    const approved = purchaseOrders.filter(po => po.status === 'approved').length;
    const partiallyFulfilled = purchaseOrders.filter(po => po.status === 'partially_fulfilled').length;
    const fulfilled = purchaseOrders.filter(po => po.status === 'fulfilled').length;

    const totalValue = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const fulfilledValue = purchaseOrders
      .filter(po => po.status === 'fulfilled')
      .reduce((sum, po) => sum + po.totalAmount, 0);

    return {
      total,
      approved,
      partiallyFulfilled,
      fulfilled,
      totalValue,
      fulfilledValue,
      fulfillmentRate: total > 0 ? (fulfilled / total) * 100 : 0
    };
  };

  const stats = getStatistics();

  return (
    <div className="po-fulfillment-dashboard">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">PO Fulfillment Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor purchase order delivery progress</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Total POs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatCurrency(stats.totalValue)}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-blue-600">Approved</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{stats.approved}</div>
          <div className="text-xs text-blue-600 mt-1">Awaiting delivery</div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-yellow-600">In Progress</div>
          <div className="text-3xl font-bold text-yellow-900 mt-1">{stats.partiallyFulfilled}</div>
          <div className="text-xs text-yellow-600 mt-1">Partially fulfilled</div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-green-600">Fulfilled</div>
          <div className="text-3xl font-bold text-green-900 mt-1">{stats.fulfilled}</div>
          <div className="text-xs text-green-600 mt-1">
            {stats.fulfillmentRate.toFixed(0)}% fulfillment rate
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by PO number, supplier, or material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as POStatusFilter)}
              className="border border-gray-300 rounded-md px-4 py-2"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="partially_fulfilled">Partially Fulfilled</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            onClick={loadPurchaseOrders}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* PO List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading purchase orders...
        </div>
      ) : filteredPOs.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500 shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2">No purchase orders found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPOs.map(po => {
            const fulfillment = calculatePOFulfillment(po);
            const isExpanded = expandedPOId === po.id;

            return (
              <div key={po.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                {/* PO Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => togglePOExpansion(po.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {po.orderNumber}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(po.status)}`}>
                          {po.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
                        <span>Supplier: {po.supplierName}</span>
                        <span>Items: {po.items.length}</span>
                        <span>Total: {formatCurrency(po.totalAmount, po.currency)}</span>
                      </div>

                      {/* Overall Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                fulfillment === 100 ? 'bg-green-600' :
                                fulfillment > 0 ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${fulfillment}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-12 text-right">
                            {fulfillment.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPODetails?.(po.id);
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        View Details
                      </button>

                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isExpanded ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* PO Items (Expanded) */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Items ({po.items.length})</h4>

                    <div className="space-y-3">
                      {po.items.map((item, index) => {
                        const itemFulfillment = calculateItemFulfillment(item);
                        const remaining = item.quantity - (item.deliveredQuantity || 0);

                        return (
                          <div
                            key={index}
                            className="bg-white border border-gray-200 rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {item.materialName}
                                </div>

                                <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Ordered:</span>
                                    <span className="ml-2 font-medium">
                                      {item.quantity} {item.unit}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-gray-600">Delivered:</span>
                                    <span className="ml-2 font-medium">
                                      {item.deliveredQuantity || 0} {item.unit}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-gray-600">Remaining:</span>
                                    <span className="ml-2 font-medium">
                                      {remaining} {item.unit}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-gray-600">Value:</span>
                                    <span className="ml-2 font-medium">
                                      {formatCurrency(item.amount, po.currency)}
                                    </span>
                                  </div>
                                </div>

                                {/* Item Progress Bar */}
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${
                                        itemFulfillment === 100 ? 'bg-green-600' :
                                        itemFulfillment > 0 ? 'bg-yellow-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${itemFulfillment}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium text-gray-600 w-10 text-right">
                                    {itemFulfillment.toFixed(0)}%
                                  </span>
                                </div>
                              </div>

                              {remaining > 0 && (
                                <button
                                  onClick={() => onRecordDelivery?.(po.id, item.materialId)}
                                  className="ml-4 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                  Record Delivery
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default POFulfillmentDashboard;
