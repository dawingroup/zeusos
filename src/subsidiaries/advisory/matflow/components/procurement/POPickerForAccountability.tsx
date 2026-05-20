/**
 * PO PICKER FOR ACCOUNTABILITY
 *
 * Component to select and link purchase orders to accountability expenses.
 * Features:
 * - Search/filter POs by project
 * - Display PO details and items
 * - Real-time variance calculation
 * - Warning indicators for mismatches
 */

import React, { useState, useEffect } from 'react';
import { procurementService } from '../../services/procurement-service';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/procurement';

// ============================================================================
// TYPES
// ============================================================================

export interface POSelectionResult {
  purchaseOrderId: string;
  poItemId: string;
  poItemLineNumber: number;
  expectedAmount: number;
  expectedQuantity: number;
  unitPrice: number;
}

interface POPickerProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  expenseAmount: number;
  expenseQuantity?: number;
  onSelect: (selection: POSelectionResult) => void;
  onCancel: () => void;
  value?: POSelectionResult;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const POPickerForAccountability: React.FC<POPickerProps> = ({
  projectId,
  materialId: _materialId,
  materialName,
  expenseAmount,
  expenseQuantity,
  onSelect,
  onCancel,
  value
}) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load purchase orders on mount
  useEffect(() => {
    loadPurchaseOrders();
  }, [projectId]);

  // Filter POs based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredPOs(purchaseOrders);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = purchaseOrders.filter(po =>
      po.orderNumber.toLowerCase().includes(query) ||
      po.supplierName.toLowerCase().includes(query) ||
      po.items.some(item => item.materialName.toLowerCase().includes(query))
    );

    setFilteredPOs(filtered);
  }, [searchQuery, purchaseOrders]);

  // Set preselected value
  useEffect(() => {
    if (value && purchaseOrders.length > 0) {
      const po = purchaseOrders.find(p => p.id === value.purchaseOrderId);
      if (po) {
        setSelectedPO(po);
        setSelectedItemId(value.poItemId);
      }
    }
  }, [value, purchaseOrders]);

  /**
   * Load purchase orders for project
   */
  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const pos = await procurementService.getPurchaseOrdersByProject(projectId);

      // Filter to relevant POs (approved, partially fulfilled, or fulfilled)
      const relevantPOs = pos.filter((po: { status: string }) =>
        po.status === 'approved' ||
        po.status === 'partially_fulfilled' ||
        po.status === 'fulfilled'
      );

      setPurchaseOrders(relevantPOs);
      setFilteredPOs(relevantPOs);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate variance between expense and PO item
   */
  const calculateVariance = (poItem: PurchaseOrderItem): {
    amountVariance: number;
    variancePercentage: number;
    quantityVariance?: number;
  } => {
    const amountVariance = expenseAmount - poItem.amount;
    const variancePercentage = (Math.abs(amountVariance) / poItem.amount) * 100;

    let quantityVariance: number | undefined;
    if (expenseQuantity !== undefined) {
      quantityVariance = expenseQuantity - poItem.quantity;
    }

    return { amountVariance, variancePercentage, quantityVariance };
  };

  /**
   * Get variance indicator color
   */
  const getVarianceColor = (variancePercentage: number): string => {
    if (variancePercentage < 2) return 'text-green-600';
    if (variancePercentage < 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  /**
   * Get variance indicator badge
   */
  const getVarianceBadge = (variancePercentage: number): React.ReactNode => {
    if (variancePercentage < 2) {
      return <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Match</span>;
    }
    if (variancePercentage < 5) {
      return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Minor Variance</span>;
    }
    return <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Investigation Required</span>;
  };

  /**
   * Handle PO selection
   */
  const handlePOClick = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setSelectedItemId(null);
  };

  /**
   * Handle item selection
   */
  const handleItemSelect = (poItem: PurchaseOrderItem) => {
    if (!selectedPO) return;

    const itemLineNumber = selectedPO.items.findIndex(i => i.materialId === poItem.materialId) + 1;

    const result: POSelectionResult = {
      purchaseOrderId: selectedPO.id,
      poItemId: poItem.materialId,
      poItemLineNumber: itemLineNumber,
      expectedAmount: poItem.amount,
      expectedQuantity: poItem.quantity,
      unitPrice: poItem.unitPrice
    };

    onSelect(result);
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount: number, currency: string = 'UGX'): string => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  return (
    <div className="po-picker-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">Link to Purchase Order</h2>
          <p className="text-sm text-blue-100 mt-1">
            Select a PO item that matches your expense
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-800 px-6 py-3">
            {error}
          </div>
        )}

        {/* Expense Summary */}
        <div className="bg-gray-50 border-b px-6 py-3">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Expense Amount:</span>
              <span className="ml-2 font-semibold">{formatCurrency(expenseAmount)}</span>
            </div>
            {expenseQuantity !== undefined && (
              <div>
                <span className="text-gray-600">Quantity:</span>
                <span className="ml-2 font-semibold">{expenseQuantity}</span>
              </div>
            )}
            {materialName && (
              <div>
                <span className="text-gray-600">Material:</span>
                <span className="ml-2 font-semibold">{materialName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b">
          <input
            type="text"
            placeholder="Search by PO number, supplier, or material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-4 py-2"
          />
        </div>

        {/* Content */}
        <div className="flex h-[50vh]">
          {/* PO List */}
          <div className="w-1/2 border-r overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading purchase orders...
              </div>
            ) : filteredPOs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No purchase orders found
              </div>
            ) : (
              <div className="divide-y">
                {filteredPOs.map(po => (
                  <div
                    key={po.id}
                    onClick={() => handlePOClick(po)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedPO?.id === po.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="font-medium">{po.orderNumber}</div>
                    <div className="text-sm text-gray-600 mt-1">{po.supplierName}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        po.status === 'approved' ? 'bg-green-100 text-green-800' :
                        po.status === 'partially_fulfilled' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {po.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {po.items.length} items
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-1">
                      {formatCurrency(po.totalAmount, po.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PO Items */}
          <div className="w-1/2 overflow-y-auto">
            {!selectedPO ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a purchase order to view items
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 mb-3">
                  PO Items ({selectedPO.items.length})
                </h3>

                {selectedPO.items.map(item => {
                  const variance = calculateVariance(item);
                  const isSelected = selectedItemId === item.materialId;

                  return (
                    <div
                      key={item.materialId}
                      onClick={() => handleItemSelect(item)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-400 hover:shadow'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {item.materialName}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {item.quantity} {item.unit} @ {formatCurrency(item.unitPrice, selectedPO.currency)} per {item.unit}
                          </div>
                          <div className="text-sm font-medium text-gray-900 mt-1">
                            Total: {formatCurrency(item.amount, selectedPO.currency)}
                          </div>

                          {/* Delivery Progress */}
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span>Delivered: {item.deliveredQuantity || 0}/{item.quantity}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full"
                                  style={{
                                    width: `${((item.deliveredQuantity || 0) / item.quantity) * 100}%`
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="ml-3">
                          {getVarianceBadge(variance.variancePercentage)}
                        </div>
                      </div>

                      {/* Variance Details */}
                      {variance.variancePercentage > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs space-y-1">
                          <div className={`flex justify-between ${getVarianceColor(variance.variancePercentage)}`}>
                            <span>Amount Variance:</span>
                            <span className="font-medium">
                              {variance.amountVariance > 0 ? '+' : ''}
                              {formatCurrency(variance.amountVariance, selectedPO.currency)}
                              ({variance.variancePercentage.toFixed(2)}%)
                            </span>
                          </div>
                          {variance.quantityVariance !== undefined && (
                            <div className="flex justify-between text-gray-600">
                              <span>Quantity Variance:</span>
                              <span className="font-medium">
                                {variance.quantityVariance > 0 ? '+' : ''}
                                {variance.quantityVariance} {item.unit}
                              </span>
                            </div>
                          )}
                          {variance.variancePercentage >= 5 && (
                            <div className="text-red-600 font-medium mt-2">
                              ⚠️ Investigation will be triggered
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedPO && selectedItemId ? (
              <span className="text-green-600 font-medium">✓ Item selected</span>
            ) : (
              'Select a PO item to link to your expense'
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedPO && selectedItemId) {
                  const item = selectedPO.items.find(i => i.materialId === selectedItemId);
                  if (item) handleItemSelect(item);
                }
              }}
              disabled={!selectedPO || !selectedItemId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Link to PO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POPickerForAccountability;
