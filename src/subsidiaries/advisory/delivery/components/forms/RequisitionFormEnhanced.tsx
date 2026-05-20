/**
 * ENHANCED REQUISITION FORM (ADD-FIN-001)
 *
 * Features:
 * - BOQ item selection with budget validation
 * - Advance policy enforcement (blocks if overdue accountabilities)
 * - Optional quotation tracking (PM responsibility)
 * - Supplier selection with reasoning
 * - Dual-approval workflow integration
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  Send,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { BOQItemSelector } from '../requisitions/BOQItemSelector';
import type { SelectedBOQItem } from '../../hooks/boq-hooks';
import type { ControlBOQItem } from '../../types/control-boq';
import type {
  RequisitionFormData,
  ExpenseCategory,
  AdvanceType,
  RequisitionType,
  SelectedSupplier,
} from '../../types/requisition';
import {
  ADVANCE_TYPE_LABELS,
  REQUISITION_TYPE_CONFIG,
  inferRequisitionType,
} from '../../types/requisition';
import { getBOQItems } from '@/subsidiaries/advisory/matflow/services/boqService';
import { RequisitionService } from '../../services/requisition-service';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface QuotationForm {
  id: string;
  supplierName: string;
  quotedAmount: number;
  documentUrl?: string;
  receivedAt: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function RequisitionFormEnhanced() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    purpose: '',
    requisitionType: 'funds' as RequisitionType,
    advanceType: 'materials' as AdvanceType,
    budgetLineId: '',
    accountabilityDueDate: new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0],
  });

  // BOQ selection
  const [selectedBOQItems, setSelectedBOQItems] = useState<SelectedBOQItem[]>([]);
  const [boqItems, setBOQItems] = useState<ControlBOQItem[]>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);

  // Quotation tracking (optional)
  const [quotations, setQuotations] = useState<QuotationForm[]>([]);
  const [showQuotationSection, setShowQuotationSection] = useState(false);

  // Supplier selection
  const [selectedSupplier, _setSelectedSupplier] = useState<Partial<SelectedSupplier>>();

  // Validation and status
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>({ valid: true, errors: [], warnings: [] });
  const [loading, setLoading] = useState(false);
  const [hasOverdueAccountabilities, setHasOverdueAccountabilities] = useState(false);

  // Load BOQ items
  useEffect(() => {
    if (projectId && user) {
      loadBOQItems();
      checkOverdueAccountabilities();
    }
  }, [projectId, user]);

  const loadBOQItems = async () => {
    if (!projectId || !user) return;

    setLoadingBOQ(true);
    try {
      console.log('RequisitionForm: Loading BOQ items for project:', projectId);

      // Get organization ID from user
      const orgId = (user as any)?.organizationId || 'default';

      // Load BOQ items from MatFlow collection
      const items = await getBOQItems(orgId, projectId);

      // Filter to available items (not fully requisitioned)
      const availableItems = items.filter(item => {
        const processed = Math.max(
          item.quantityRequisitioned || 0,
          item.quantityCertified || 0
        );
        return (item.quantityContract ?? 0) > processed;
      });

      console.log('RequisitionForm: Loaded BOQ items:', {
        total: items.length,
        available: availableItems.length,
        sample: availableItems.slice(0, 3).map(i => ({
          id: i.id,
          description: i.description,
          quantityContract: i.quantityContract,
          quantityRequisitioned: i.quantityRequisitioned || 0,
          quantityCertified: i.quantityCertified || 0,
        }))
      });

      // Cast MatFlow BOQItem to ControlBOQItem for compatibility
      const convertedItems = availableItems.map(item => ({
        ...item,
        quantityRequisitioned: item.quantityRequisitioned || 0,
        quantityCertified: item.quantityCertified || 0,
        quantityExecuted: item.quantityExecuted || 0,
        quantityRemaining: item.quantityRemaining || item.quantityContract,
      })) as unknown as ControlBOQItem[];

      setBOQItems(convertedItems);
    } catch (error) {
      console.error('Failed to load BOQ items:', error);
      setValidationResult({
        valid: false,
        errors: ['Failed to load BOQ items. Please try again.'],
        warnings: [],
      });
    } finally {
      setLoadingBOQ(false);
    }
  };

  const checkOverdueAccountabilities = async () => {
    if (!projectId || !user) return;

    try {
      // Check for requisitions with overdue accountabilities
      const requisitionsRef = collection(db, 'requisitions');
      const q = query(
        requisitionsRef,
        where('projectId', '==', projectId),
        where('createdBy', '==', user.uid),
        where('accountabilityStatus', '==', 'overdue')
      );

      const snapshot = await getDocs(q);
      setHasOverdueAccountabilities(!snapshot.empty);
    } catch (error) {
      console.error('Failed to check accountabilities:', error);
    }
  };

  // BOQ item handlers
  const handleSelectBOQItem = (item: ControlBOQItem, quantity?: number) => {
    const selected: SelectedBOQItem = {
      item,
      quantityRequested: quantity || 1,
    };
    setSelectedBOQItems((prev) => [...prev, selected]);
  };

  const handleDeselectBOQItem = (itemId: string) => {
    setSelectedBOQItems((prev) => prev.filter((s) => s.item.id !== itemId));
  };

  const handleUpdateBOQQuantity = (itemId: string, quantity: number) => {
    setSelectedBOQItems((prev) =>
      prev.map((s) =>
        s.item.id === itemId ? { ...s, quantityRequested: quantity } : s
      )
    );
  };

  const isBOQItemSelected = (itemId: string) => {
    return selectedBOQItems.some((s) => s.item.id === itemId);
  };

  const getBOQItemQuantity = (itemId: string) => {
    return selectedBOQItems.find((s) => s.item.id === itemId)?.quantityRequested || 1;
  };

  // Quotation handlers
  const addQuotation = () => {
    setQuotations((prev) => [
      ...prev,
      {
        id: generateId(),
        supplierName: '',
        quotedAmount: 0,
        receivedAt: new Date().toISOString().split('T')[0],
      },
    ]);
  };

  const updateQuotation = (
    id: string,
    field: keyof QuotationForm,
    value: string | number
  ) => {
    setQuotations((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const removeQuotation = (id: string) => {
    setQuotations((prev) => prev.filter((q) => q.id !== id));
  };

  // Calculations
  const grandTotal = useMemo(() => {
    return selectedBOQItems.reduce(
      (sum, s) => sum + s.quantityRequested * s.item.rate,
      0
    );
  }, [selectedBOQItems]);

  const lowestQuotation = useMemo(() => {
    if (quotations.length === 0) return null;
    return Math.min(...quotations.map((q) => q.quotedAmount));
  }, [quotations]);

  // Validation
  const validateForm = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!formData.purpose) {
      errors.push('Purpose is required');
    }

    if (selectedBOQItems.length === 0) {
      errors.push('Select at least one BOQ item');
    }

    if (hasOverdueAccountabilities) {
      errors.push(
        'You have overdue accountabilities. Complete them before creating new requisitions.'
      );
    }

    // Quotation warnings (not errors - quotations are optional)
    if (quotations.length > 0 && quotations.length < 3) {
      warnings.push(
        'Best practice: Obtain at least 3 quotations for competitive pricing'
      );
    }

    if (quotations.length > 0 && !selectedSupplier?.name) {
      warnings.push('Consider selecting a supplier from your quotations');
    }

    setValidationResult({ valid: errors.length === 0, errors, warnings });
    return errors.length === 0;
  };

  const handleSubmit = async (submitForApproval: boolean = false) => {
    if (!validateForm()) return;
    if (!projectId || !user) return;

    setLoading(true);
    try {
      // Build requisition data
      const requisitionData: RequisitionFormData = {
        projectId,
        purpose: formData.purpose,
        requisitionType: formData.requisitionType,
        advanceType: formData.advanceType,
        budgetLineId: formData.budgetLineId || 'default',
        accountabilityDueDate: new Date(formData.accountabilityDueDate),
        sourceType: 'boq',
        items: selectedBOQItems.map((s) => ({
          description: s.item.description,
          category: 'construction_materials' as ExpenseCategory,
          quantity: s.quantityRequested,
          unit: s.item.unit,
          unitCost: s.item.rate,
          totalCost: s.quantityRequested * s.item.rate,
          sourceType: 'boq',
          boqItemId: s.item.id,
          boqItemCode: s.item.itemCode || s.item.itemNumber,
        })),
        quotations: quotations.map((q) => ({
          id: q.id,
          supplierName: q.supplierName,
          quotedAmount: q.quotedAmount,
          documentUrl: q.documentUrl,
          receivedAt: new Date(q.receivedAt),
        })) as any,
        selectedSupplier: selectedSupplier as SelectedSupplier,
      };

      // Create requisition using RequisitionService
      const requisitionService = RequisitionService.getInstance(db);
      const orgId = (user as any)?.organizationId || 'default';
      const requisitionId = await requisitionService.createRequisition(
        requisitionData,
        user.uid,
        orgId
      );

      // Navigate based on action
      if (submitForApproval) {
        navigate(`/advisory/delivery/requisitions/${requisitionId}`);
      } else {
        navigate(`/advisory/delivery/projects/${projectId}/requisitions`);
      }
    } catch (error: any) {
      console.error('Failed to create requisition:', error);
      setValidationResult({
        valid: false,
        errors: [error.message || 'Failed to create requisition'],
        warnings: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            New Requisition (ADD-FIN-001)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            BOQ-controlled requisition with approval workflow
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {/* Validation messages */}
      {validationResult.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-1">
                Cannot create requisition
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {validationResult.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-900 mb-1">Warnings</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validationResult.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Overdue accountability block */}
      {hasOverdueAccountabilities && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">
                Overdue Accountabilities Detected
              </h3>
              <p className="text-sm text-red-700">
                You cannot create new requisitions until all overdue
                accountabilities are completed. This is enforced by ADD-FIN-001
                advance policy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Basic Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.purpose}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, purpose: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the purpose of this requisition..."
            />
          </div>

          {/* Requisition Type Selector */}
          <div className="col-span-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requisition Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(REQUISITION_TYPE_CONFIG) as [RequisitionType, typeof REQUISITION_TYPE_CONFIG[RequisitionType]][]).map(
                ([type, config]) => {
                  const isSelected = formData.requisitionType === type;
                  const borderColor = isSelected
                    ? config.color === 'blue' ? 'border-blue-600 bg-blue-50'
                    : config.color === 'green' ? 'border-green-600 bg-green-50'
                    : 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300';
                  const defaultAdvance: AdvanceType =
                    type === 'funds' ? 'transport'
                    : type === 'materials' ? 'materials'
                    : 'labor';
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          requisitionType: type,
                          advanceType: defaultAdvance,
                        }))
                      }
                      className={`p-4 rounded-lg border-2 text-left transition-all ${borderColor}`}
                    >
                      <div className="font-semibold text-gray-900">
                        {config.label}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {config.description}
                      </p>
                      {config.supportsPO && (
                        <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          PO will be generated
                        </span>
                      )}
                      {config.isParent && (
                        <span className="inline-block mt-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                          Parent requisition
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Advance Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.advanceType}
              onChange={(e) => {
                const advanceType = e.target.value as AdvanceType;
                setFormData((prev) => ({
                  ...prev,
                  advanceType,
                  requisitionType: inferRequisitionType(advanceType),
                }));
              }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {Object.entries(ADVANCE_TYPE_LABELS)
                .filter(([value]) => {
                  if (formData.requisitionType === 'funds') {
                    return ['transport', 'miscellaneous'].includes(value);
                  }
                  if (formData.requisitionType === 'materials') {
                    return ['materials', 'equipment'].includes(value);
                  }
                  if (formData.requisitionType === 'labour') {
                    return ['labor'].includes(value);
                  }
                  return true;
                })
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accountability Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.accountabilityDueDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  accountabilityDueDate: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              ADD-FIN-001: {formData.advanceType === 'materials' ? '14' : '7'}{' '}
              days standard
            </p>
          </div>
        </div>
      </div>

      {/* BOQ Item Selection */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Select BOQ Items
          </h2>
          {selectedBOQItems.length > 0 && (
            <div className="text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-semibold text-primary ml-2">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          )}
        </div>

        <BOQItemSelector
          items={boqItems}
          selectedItems={selectedBOQItems}
          loading={loadingBOQ}
          error={null}
          onSelectItem={handleSelectBOQItem}
          onDeselectItem={handleDeselectBOQItem}
          onUpdateQuantity={handleUpdateBOQQuantity}
          isSelected={isBOQItemSelected}
          getSelectedQuantity={getBOQItemQuantity}
        />
      </div>

      {/* Optional: Quotation Tracking */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Quotations (Optional)
            </h2>
            <p className="text-sm text-gray-500">
              PM responsibility - For reference only, not enforced
            </p>
          </div>
          <button
            onClick={() => setShowQuotationSection(!showQuotationSection)}
            className="text-sm text-primary hover:underline"
          >
            {showQuotationSection ? 'Hide' : 'Add Quotations'}
          </button>
        </div>

        {showQuotationSection && (
          <div className="space-y-4">
            {quotations.map((quotation, index) => (
              <div
                key={quotation.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Quotation {index + 1}
                  </span>
                  <button
                    onClick={() => removeQuotation(quotation.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Supplier name"
                    value={quotation.supplierName}
                    onChange={(e) =>
                      updateQuotation(quotation.id, 'supplierName', e.target.value)
                    }
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Quoted amount"
                    value={quotation.quotedAmount || ''}
                    onChange={(e) =>
                      updateQuotation(
                        quotation.id,
                        'quotedAmount',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="date"
                    value={quotation.receivedAt}
                    onChange={(e) =>
                      updateQuotation(quotation.id, 'receivedAt', e.target.value)
                    }
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addQuotation}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary hover:text-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Quotation
            </button>

            {lowestQuotation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <CheckCircle2 className="w-4 h-4 inline mr-2" />
                Lowest quotation: {formatCurrency(lowestQuotation)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={loading || hasOverdueAccountabilities}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Draft
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={loading || hasOverdueAccountabilities}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Submit for Approval
        </button>
      </div>
    </div>
  );
}

export default RequisitionFormEnhanced;
