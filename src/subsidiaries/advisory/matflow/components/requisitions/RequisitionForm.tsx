/**
 * Requisition Form Component
 * Form for creating and editing material requisitions
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  Send,
  X,
  Calendar,
  FileText,
  Search,
} from 'lucide-react';
// cn utility available from @/core/lib/utils if needed

interface RequisitionItem {
  id: string;
  description: string;
  materialId?: string;
  quantity: number;
  unit: string;
  estimatedRate: number;
  specifications?: string;
  notes?: string;
}

interface RequisitionFormData {
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requiredDate: string;
  items: RequisitionItem[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const RequisitionForm: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, requisitionId } = useParams<{ projectId: string; requisitionId?: string }>();
  const isEdit = !!requisitionId;

  const [formData, setFormData] = useState<RequisitionFormData>({
    description: '',
    priority: 'normal',
    requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [
      { id: generateId(), description: '', quantity: 0, unit: '', estimatedRate: 0 },
    ],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBOQSelector, setShowBOQSelector] = useState(false);

  // Calculate totals
  const calculateItemTotal = (item: RequisitionItem) => {
    return item.quantity * item.estimatedRate;
  };

  const grandTotal = formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  // Item management
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { id: generateId(), description: '', quantity: 0, unit: '', estimatedRate: 0 }],
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

  const updateItem = (index: number, field: keyof RequisitionItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Form submission
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      // Placeholder - will connect to service
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate(`/advisory/matflow/${projectId}/requisitions`);
    } catch (err) {
      console.error('Failed to save draft:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setIsSubmitting(true);
    try {
      // Placeholder - will connect to service
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate(`/advisory/matflow/${projectId}/requisitions`);
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Requisition' : 'New Requisition'}
        </h1>
        <p className="text-gray-500">
          Create a material requisition for project procurement
        </p>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this requisition..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as RequisitionFormData['priority'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.requiredDate}
                onChange={(e) => setFormData(prev => ({ ...prev, requiredDate: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Items</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBOQSelector(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FileText className="w-4 h-4" />
              Add from BOQ
            </button>
            <button
              onClick={addItem}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-12">#</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 min-w-[250px]">Description</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-28">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-24">Unit</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-36">Est. Rate</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-36">Total</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700 w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {formData.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Search or enter description"
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(index, 'unit', e.target.value)}
                      placeholder="e.g., m³"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">UGX</span>
                      <input
                        type="number"
                        value={item.estimatedRate || ''}
                        onChange={(e) => updateItem(index, 'estimatedRate', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
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
                <td colSpan={5} className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold">Grand Total:</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-lg font-bold text-blue-600">
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
          onClick={() => navigate(`/advisory/matflow/${projectId}/requisitions`)}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={handleSubmitForApproval}
            disabled={isSubmitting || !formData.description || formData.items.every(i => !i.description)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Submit for Approval
          </button>
        </div>
      </div>

      {/* BOQ Selector Modal */}
      {showBOQSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBOQSelector(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select BOQ Items</h3>
              <button onClick={() => setShowBOQSelector(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              <p className="text-gray-500 text-center py-8">
                BOQ items will be loaded here from the project BOQ.
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowBOQSelector(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowBOQSelector(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequisitionForm;
