/**
 * Requisition Form Component
 * Form for creating and editing requisitions in the Delivery module
 */

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  Send,
  X,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useCreateRequisition } from '../../hooks/payment-hooks';
import { RequisitionFormData, ExpenseCategory, EXPENSE_CATEGORY_LABELS, AdvanceType, ADVANCE_TYPE_LABELS, inferRequisitionType } from '../../types/requisition';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

interface RequisitionItemForm {
  id: string;
  description: string;
  category: ExpenseCategory;
  quantity: number;
  unit: string;
  unitCost: number;
  notes?: string;
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

export function RequisitionForm() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  
  const { createRequisition, loading, error } = useCreateRequisition(db, user?.uid || '');

  const [formData, setFormData] = useState({
    purpose: '',
    advanceType: 'materials' as AdvanceType,
    budgetLineId: '',
    budgetLineName: '',
    accountabilityDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [
      { 
        id: generateId(), 
        description: '', 
        category: 'construction_materials' as ExpenseCategory,
        quantity: 0, 
        unit: '', 
        unitCost: 0,
        notes: '',
      },
    ] as RequisitionItemForm[],
  });

  const calculateItemTotal = (item: RequisitionItemForm) => {
    return item.quantity * item.unitCost;
  };

  const grandTotal = useMemo(() => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  }, [formData.items]);

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { 
        id: generateId(), 
        description: '', 
        category: 'construction_materials' as ExpenseCategory,
        quantity: 0, 
        unit: '', 
        unitCost: 0,
        notes: '',
      }],
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const updateItem = (index: number, field: keyof RequisitionItemForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSave = async (submitForApproval: boolean = false) => {
    if (!projectId) return;

    const requisitionData: RequisitionFormData = {
      projectId,
      purpose: formData.purpose,
      requisitionType: inferRequisitionType(formData.advanceType),
      advanceType: formData.advanceType,
      budgetLineId: formData.budgetLineId || formData.budgetLineName,
      accountabilityDueDate: new Date(formData.accountabilityDueDate),
      sourceType: 'manual',
      items: formData.items.map(item => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: calculateItemTotal(item),
        notes: item.notes,
      })),
    };

    try {
      const id = await createRequisition(requisitionData);
      if (submitForApproval) {
        navigate(`/advisory/delivery/requisitions/${id}`);
      } else {
        navigate(`/advisory/delivery/projects/${projectId}/requisitions`);
      }
    } catch (err) {
      console.error('Failed to create requisition:', err);
    }
  };

  const isValid = formData.purpose && 
    formData.items.some(item => item.description && item.quantity > 0 && item.unitCost > 0);

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Requisition</h1>
        <p className="text-gray-500">Request funds for project activities</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error.message}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.purpose}
              onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
              placeholder="Describe the purpose of this requisition..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Advance Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.advanceType}
              onChange={(e) => setFormData(prev => ({ ...prev, advanceType: e.target.value as AdvanceType }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {Object.entries(ADVANCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accountability Due Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.accountabilityDueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, accountabilityDueDate: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Line (Optional)
            </label>
            <input
              type="text"
              value={formData.budgetLineName}
              onChange={(e) => setFormData(prev => ({ ...prev, budgetLineName: e.target.value }))}
              placeholder="e.g., Construction Materials"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Line Items</h2>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-12">#</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 min-w-[200px]">Description</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-40">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-24">Qty</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-20">Unit</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-32">Unit Cost</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-32">Total</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700 w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {formData.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(index, 'category', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(index, 'unit', e.target.value)}
                      placeholder="e.g., bags"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.unitCost || ''}
                      onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      {formatCurrency(calculateItemTotal(item))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                      className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold">Grand Total:</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(grandTotal)}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(`/advisory/delivery/projects/${projectId}/requisitions`)}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={loading || !isValid}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading || !isValid}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Save & View
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequisitionForm;
