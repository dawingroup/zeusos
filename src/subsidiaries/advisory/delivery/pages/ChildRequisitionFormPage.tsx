/**
 * Child Requisition Form Page
 *
 * Create a materials or labour requisition linked to a parent funds requisition.
 * Pre-populates BOQ items from the parent and shows budget warnings.
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Hammer,
  Save,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { BOQItemSelector } from '../components/requisitions/BOQItemSelector';
import { BudgetWarningBanner } from '../components/requisitions/BudgetWarningBanner';
import {
  useParentRequisition,
  useParentBOQItems,
  useChildRequisitions,
  useCreateChildRequisition,
} from '../hooks/payment-hooks';
import type { SelectedBOQItem } from '../hooks/boq-hooks';
import type {
  RequisitionFormData,
  RequisitionType,
  ExpenseCategory,
} from '../types/requisition';
import { REQUISITION_TYPE_CONFIG } from '../types/requisition';
import { getBOQItems } from '@/subsidiaries/advisory/matflow/services/boqService';
import type { ControlBOQItem } from '../types/control-boq';

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

export function ChildRequisitionFormPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const parentId = searchParams.get('parentId');
  const childType = (searchParams.get('type') || 'materials') as RequisitionType;

  // Fetch parent data
  const { parent, loading: parentLoading } = useParentRequisition(db, parentId);
  const { boqItems: parentBoqItems, loading: boqLoading } = useParentBOQItems(db, parentId);
  const { totalChildAmount, loading: childrenLoading } = useChildRequisitions(db, parentId);

  // Form state
  const [purpose, setPurpose] = useState('');
  const [isLabourAdvance, setIsLabourAdvance] = useState(false);
  const [labourAdvanceAmount, setLabourAdvanceAmount] = useState(0);
  const [selectedBOQItems, setSelectedBOQItems] = useState<SelectedBOQItem[]>([]);
  const [accountabilityDueDate, setAccountabilityDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All project BOQ items for the selector
  const [projectBoqItems, setProjectBoqItems] = useState<ControlBOQItem[]>([]);
  const [boqItemsLoading, setBoqItemsLoading] = useState(true);

  const { createChildRequisition, loading: creating } = useCreateChildRequisition(
    db,
    user?.uid || ''
  );

  const config = REQUISITION_TYPE_CONFIG[childType];

  // Load project BOQ items
  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const orgId = (user as any)?.organizationId || 'default';
        const items = await getBOQItems(orgId, projectId);
        setProjectBoqItems(items as unknown as ControlBOQItem[]);
      } catch {
        console.error('Failed to load BOQ items');
      } finally {
        setBoqItemsLoading(false);
      }
    };
    load();
  }, [projectId, user]);

  // Calculate totals
  const currentAmount = useMemo(() => {
    if (isLabourAdvance) return labourAdvanceAmount;
    return selectedBOQItems.reduce(
      (sum, s) => sum + s.quantityRequested * s.item.rate,
      0
    );
  }, [selectedBOQItems, isLabourAdvance, labourAdvanceAmount]);

  const parentAmount = parent?.grossAmount || 0;

  const handleSubmit = async (submitForApproval: boolean = false) => {
    if (!projectId || !user || !parentId) return;
    if (!purpose.trim()) {
      setError('Purpose is required');
      return;
    }
    if (!isLabourAdvance && selectedBOQItems.length === 0) {
      setError('Select at least one BOQ item');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requisitionData: RequisitionFormData = {
        projectId,
        purpose,
        requisitionType: childType,
        advanceType: childType === 'materials' ? 'materials' : 'labor',
        budgetLineId: 'default',
        accountabilityDueDate: new Date(accountabilityDueDate),
        sourceType: isLabourAdvance ? 'manual' : 'boq',
        items: isLabourAdvance
          ? [{
              description: purpose,
              category: 'labor_wages' as ExpenseCategory,
              quantity: 1,
              unit: 'lump sum',
              unitCost: labourAdvanceAmount,
              totalCost: labourAdvanceAmount,
            }]
          : selectedBOQItems.map((s) => ({
              description: s.item.description,
              category: (childType === 'materials' ? 'construction_materials' : 'labor_wages') as ExpenseCategory,
              quantity: s.quantityRequested,
              unit: s.item.unit,
              unitCost: s.item.rate,
              totalCost: s.quantityRequested * s.item.rate,
              sourceType: 'boq' as const,
              boqItemId: s.item.id,
              boqItemCode: s.item.itemCode || s.item.itemNumber,
            })),
        parentRequisitionId: parentId,
        parentRequisitionNumber: parent?.requisitionNumber,
        isLabourAdvance: isLabourAdvance,
      };

      const requisitionId = await createChildRequisition(requisitionData);

      if (submitForApproval) {
        navigate(`/advisory/delivery/requisitions/${requisitionId}`);
      } else {
        navigate(`/advisory/delivery/projects/${projectId}/requisitions`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create requisition';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (parentLoading || boqLoading || childrenLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading parent requisition...</span>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-gray-700">Parent requisition not found</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const isProcessing = loading || creating;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {childType === 'materials' ? (
              <Package className="w-5 h-5 text-blue-600" />
            ) : (
              <Hammer className="w-5 h-5 text-green-600" />
            )}
            New {config.label}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Against: <span className="font-medium">{parent.requisitionNumber}</span> — {parent.purpose}
          </p>
        </div>
      </div>

      {/* Parent Budget Summary */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Parent Funds Budget</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Funds</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(parentAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Allocated to Children</p>
            <p className="text-lg font-bold text-gray-700">{formatCurrency(totalChildAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Remaining</p>
            <p className={`text-lg font-bold ${parentAmount - totalChildAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(parentAmount - totalChildAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Budget Warning */}
      {currentAmount > 0 && (
        <div className="mb-6">
          <BudgetWarningBanner
            parentAmount={parentAmount}
            existingChildTotal={totalChildAmount}
            currentAmount={currentAmount}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purpose <span className="text-red-500">*</span>
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg resize-none"
            rows={2}
            placeholder={`Describe the purpose of this ${childType} requisition...`}
          />
        </div>

        {/* Labour: Advance toggle */}
        {childType === 'labour' && (
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLabourAdvance}
                onChange={(e) => setIsLabourAdvance(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-green-800">
                Labour Advance (lump sum)
              </span>
            </label>
            <p className="text-xs text-green-600">
              Create as an advance that will be reconciled against BOQ items later
            </p>
          </div>
        )}

        {/* Labour Advance Amount */}
        {isLabourAdvance && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Advance Amount (UGX) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={labourAdvanceAmount || ''}
              onChange={(e) => setLabourAdvanceAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter advance amount"
              min={0}
            />
          </div>
        )}

        {/* BOQ Item Selector (when not advance) */}
        {!isLabourAdvance && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select BOQ Items
            </label>
            {parentBoqItems && parentBoqItems.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <CheckCircle2 className="w-3 h-3 inline mr-1" />
                  Parent requisition includes {parentBoqItems.length} BOQ items.
                  You can select from these or add additional items from the project BOQ.
                </p>
              </div>
            )}
            {boqItemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <BOQItemSelector
                items={projectBoqItems}
                selectedItems={selectedBOQItems}
                onSelectItem={(item, quantity) => {
                  setSelectedBOQItems(prev => [
                    ...prev,
                    { item, quantityRequested: quantity || 1 },
                  ]);
                }}
                onDeselectItem={(itemId) => {
                  setSelectedBOQItems(prev =>
                    prev.filter(s => s.item.id !== itemId)
                  );
                }}
                onUpdateQuantity={(itemId, quantity) => {
                  setSelectedBOQItems(prev =>
                    prev.map(s =>
                      s.item.id === itemId ? { ...s, quantityRequested: quantity } : s
                    )
                  );
                }}
                isSelected={(itemId) =>
                  selectedBOQItems.some(s => s.item.id === itemId)
                }
                getSelectedQuantity={(itemId) =>
                  selectedBOQItems.find(s => s.item.id === itemId)?.quantityRequested || 0
                }
              />
            )}
          </div>
        )}

        {/* Accountability Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Accountability Due Date
          </label>
          <input
            type="date"
            value={accountabilityDueDate}
            onChange={(e) => setAccountabilityDueDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Amount</span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(currentAmount)}
            </span>
          </div>
          {selectedBOQItems.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedBOQItems.length} BOQ item{selectedBOQItems.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as Draft
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
              childType === 'materials'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}
