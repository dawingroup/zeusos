/**
 * New BOQ Requisition Page
 * Create a requisition by selecting items from the Control BOQ
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Send,
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { BOQItemSelector } from '../components/requisitions/BOQItemSelector';
import { useProjectBOQItems, useBOQItemSelection, useBOQSummary } from '../hooks/boq-hooks';
import { useCreateRequisition } from '../hooks/payment-hooks';
import { RequisitionFormData, AdvanceType, ADVANCE_TYPE_LABELS, inferRequisitionType } from '../types/requisition';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function NewBOQRequisitionPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  // Fetch BOQ items
  const { items, loading: boqLoading, error: boqError } = useProjectBOQItems(
    db,
    projectId || null,
    { onlyAvailable: true }
  );

  // BOQ item selection state
  const {
    selectedItems,
    totalAmount,
    totalItems,
    selectItem,
    deselectItem,
    updateQuantity,
    isSelected,
    getSelectedQuantity,
    clearSelection,
  } = useBOQItemSelection();

  // BOQ summary
  const boqSummary = useBOQSummary(items);

  // Form state
  const [purpose, setPurpose] = useState('');
  const [advanceType, setAdvanceType] = useState<AdvanceType>('materials');
  const [accountabilityDueDate, setAccountabilityDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Create requisition
  const { createRequisition, loading: creating, error: createError } = useCreateRequisition(
    db,
    user?.uid || ''
  );

  const [step, setStep] = useState<'select' | 'review'>('select');

  const canProceed = selectedItems.length > 0;
  const canSubmit = canProceed && purpose.trim().length > 0;

  const handleSubmit = async () => {
    if (!projectId || !canSubmit) return;

    const formData: RequisitionFormData = {
      projectId,
      purpose,
      requisitionType: inferRequisitionType(advanceType),
      advanceType,
      budgetLineId: '',
      accountabilityDueDate: new Date(accountabilityDueDate),
      sourceType: 'boq',
      items: [],
      boqItems: selectedItems.map(s => ({
        boqItemId: s.item.id,
        boqItemCode: s.item.itemCode,
        description: s.item.description,
        specification: s.item.specification,
        billName: s.item.billName,
        sectionName: s.item.sectionName,
        unit: s.item.unit,
        quantityRequested: s.quantityRequested,
        quantityAvailable: s.item.quantityContract - s.item.quantityRequisitioned,
        rate: s.item.rate,
        amount: s.quantityRequested * s.item.rate,
        notes: s.notes,
      })),
    };

    try {
      const id = await createRequisition(formData);
      navigate(`/advisory/delivery/requisitions/${id}`);
    } catch (err) {
      console.error('Failed to create requisition:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">New Requisition from BOQ</h1>
              <p className="text-sm text-gray-500">
                Select items from the Control BOQ for planned implementation
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('select')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  step === 'select' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Package className="w-4 h-4" />
                1. Select Items
              </button>
              <button
                onClick={() => canProceed && setStep('review')}
                disabled={!canProceed}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  step === 'review' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                } disabled:opacity-50`}
              >
                <CheckCircle className="w-4 h-4" />
                2. Review & Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {createError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{createError.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3">
            {step === 'select' && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">Select BOQ Items</h2>
                <BOQItemSelector
                  items={items}
                  selectedItems={selectedItems}
                  loading={boqLoading}
                  error={boqError}
                  onSelectItem={selectItem}
                  onDeselectItem={deselectItem}
                  onUpdateQuantity={updateQuantity}
                  isSelected={isSelected}
                  getSelectedQuantity={getSelectedQuantity}
                />
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-6">
                {/* Requisition Details */}
                <div className="bg-white rounded-lg border p-6">
                  <h2 className="text-lg font-semibold mb-4">Requisition Details</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Purpose <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="Describe the purpose of this requisition..."
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Advance Type
                      </label>
                      <select
                        value={advanceType}
                        onChange={(e) => setAdvanceType(e.target.value as AdvanceType)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        {Object.entries(ADVANCE_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Accountability Due Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={accountabilityDueDate}
                          onChange={(e) => setAccountabilityDueDate(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Items */}
                <div className="bg-white rounded-lg border">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">
                      Selected Items ({selectedItems.length})
                    </h2>
                    <button
                      onClick={() => setStep('select')}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit Selection
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Code</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Qty</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Unit</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Rate</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedItems.map(({ item, quantityRequested }) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm font-mono text-gray-500">
                              {item.itemCode}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm">{item.description}</div>
                              {item.billName && (
                                <div className="text-xs text-gray-500">{item.billName}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">{quantityRequested}</td>
                            <td className="px-4 py-3 text-sm">{item.unit}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              {formatCurrency(item.rate)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-right">
                              {formatCurrency(quantityRequested * item.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-right">
                            Total
                          </td>
                          <td className="px-4 py-3 text-lg font-bold text-right text-primary">
                            {formatCurrency(totalAmount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selection Summary */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-medium text-gray-900 mb-3">Selection Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Items Selected</span>
                  <span className="font-medium">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-bold text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {selectedItems.length > 0 && (
                <button
                  onClick={clearSelection}
                  className="w-full mt-4 text-sm text-red-600 hover:underline"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* BOQ Summary */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-medium text-gray-900 mb-3">Control BOQ</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Items</span>
                  <span>{boqSummary.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Contract Value</span>
                  <span>{formatCurrency(boqSummary.totalContractValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Already Requisitioned</span>
                  <span>{formatCurrency(boqSummary.requisitionedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Remaining</span>
                  <span className="text-green-600 font-medium">
                    {formatCurrency(boqSummary.remainingValue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg border p-4 space-y-3">
              {step === 'select' && (
                <button
                  onClick={() => setStep('review')}
                  disabled={!canProceed}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  Continue to Review
                </button>
              )}

              {step === 'review' && (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={creating || !canSubmit}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Submit Requisition
                  </button>
                  <button
                    onClick={() => setStep('select')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Back to Selection
                  </button>
                </>
              )}

              <button
                onClick={() => navigate(`/advisory/delivery/projects/${projectId}/requisitions`)}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewBOQRequisitionPage;
