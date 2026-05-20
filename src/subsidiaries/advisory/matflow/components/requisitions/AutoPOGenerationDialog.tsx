/**
 * AUTO-PO GENERATION CONFIRMATION DIALOG
 *
 * Displays summary of automatically generated purchase orders after requisition approval.
 * Features:
 * - Show generated POs with supplier breakdown
 * - Display item counts and amounts per supplier
 * - Highlight unassigned items requiring manual supplier selection
 * - Provide links to view/edit generated POs
 */

import React from 'react';
import type { POGenerationResult } from '../../services/auto-po-generation.service';

// ============================================================================
// TYPES
// ============================================================================

interface AutoPOGenerationDialogProps {
  result: POGenerationResult;
  requisitionNumber: string;
  onViewPO?: (poId: string) => void;
  onAssignSuppliers?: () => void;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AutoPOGenerationDialog: React.FC<AutoPOGenerationDialogProps> = ({
  result,
  requisitionNumber,
  onViewPO,
  onAssignSuppliers,
  onClose
}) => {
  const hasUnassignedItems = result.summary.supplierBreakdown.some(
    s => s.supplierId === 'unassigned'
  );

  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  /**
   * Format currency
   */
  const formatCurrency = (amount: number): string => {
    return `${amount.toLocaleString()} UGX`;
  };

  /**
   * Get status color
   */
  const getStatusColor = (): string => {
    if (!result.success || hasErrors) return 'bg-red-600';
    if (hasWarnings) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (): string => {
    if (!result.success || hasErrors) return '❌';
    if (hasWarnings) return '⚠️';
    return '✅';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`${getStatusColor()} text-white px-6 py-4`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getStatusIcon()}</span>
            <div>
              <h2 className="text-2xl font-bold">Purchase Orders Generated</h2>
              <p className="text-sm opacity-90 mt-1">
                Requisition: {requisitionNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Total POs</div>
              <div className="text-3xl font-bold text-blue-900 mt-1">
                {result.summary.totalPOs}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Total Items</div>
              <div className="text-3xl font-bold text-green-900 mt-1">
                {result.summary.totalItems}
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">Total Amount</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">
                {formatCurrency(result.summary.totalAmount)}
              </div>
            </div>
          </div>

          {/* Errors */}
          {hasErrors && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-red-600 text-xl">❌</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">Errors</h3>
                  <ul className="space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-800">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-800">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Supplier Breakdown */}
          {result.summary.supplierBreakdown.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Purchase Orders by Supplier</h3>

              <div className="space-y-4">
                {result.summary.supplierBreakdown.map((supplier, index) => {
                  const isUnassigned = supplier.supplierId === 'unassigned';

                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${
                        isUnassigned
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {supplier.supplierName}
                            </h4>
                            {isUnassigned && (
                              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                                Action Required
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-gray-600">PO Number:</span>
                              <button
                                onClick={() => onViewPO?.(supplier.poId)}
                                className="ml-2 text-blue-600 hover:text-blue-800 font-medium hover:underline"
                              >
                                View PO →
                              </button>
                            </div>

                            <div>
                              <span className="text-gray-600">Items:</span>
                              <span className="ml-2 font-medium">{supplier.itemCount}</span>
                            </div>

                            <div className="col-span-2">
                              <span className="text-gray-600">Total Amount:</span>
                              <span className="ml-2 font-semibold text-lg">
                                {formatCurrency(supplier.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {isUnassigned && (
                            <div className="mt-3 pt-3 border-t border-yellow-200">
                              <p className="text-sm text-yellow-800">
                                ⚠️ This PO contains items without supplier assignments.
                                Please assign a supplier before submitting.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No POs Generated */}
          {result.summary.totalPOs === 0 && (
            <div className="text-center py-8 text-gray-500">
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
              <p className="mt-2">No purchase orders were generated</p>
              <p className="text-sm mt-1">Check errors above for details</p>
            </div>
          )}

          {/* Next Steps */}
          {result.success && result.summary.totalPOs > 0 && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Next Steps</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                {hasUnassignedItems && (
                  <li>Assign suppliers to items marked as "To Be Assigned"</li>
                )}
                <li>Review generated purchase orders for accuracy</li>
                <li>Submit purchase orders for approval</li>
                <li>Track delivery fulfillment as materials arrive</li>
                {!hasUnassignedItems && (
                  <li>Requisition will automatically update as POs are fulfilled</li>
                )}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between items-center">
          <div>
            {hasUnassignedItems && (
              <button
                onClick={onAssignSuppliers}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                Assign Suppliers Now →
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {result.purchaseOrderIds.length > 0 && onViewPO && (
              <button
                onClick={() => onViewPO(result.purchaseOrderIds[0])}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                View First PO
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoPOGenerationDialog;
