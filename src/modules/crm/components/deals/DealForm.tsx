/**
 * DealForm Component
 * Create/edit deal dialog
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { CRMDeal, CRMDealStage, DealSource, DealPriority } from '../../types';
import {
  CRM_DEAL_STAGE_LABELS,
  CRM_ACTIVE_DEAL_STAGES,
  DEAL_SOURCE_LABELS,
  DEAL_PRIORITY_LABELS,
  CRM_DEFAULT_CURRENCY,
  CRM_SUPPORTED_CURRENCIES,
} from '../../constants/crm.constants';
import { CustomerPicker } from '@/modules/customer-hub/components';

interface DealFormProps {
  deal?: CRMDeal;
  onSubmit: (data: DealFormValues) => Promise<void>;
  onClose: () => void;
}

export interface DealFormValues {
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  stage: CRMDealStage;
  priority: DealPriority;
  source: DealSource;
  estimatedValue: number;
  currency: string;
  expectedCloseDate: string;
  siteLocation: { address?: string; city?: string; country?: string };
  tags: string[];
  notes: string;
}

export function DealForm({ deal, onSubmit, onClose }: DealFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<DealFormValues>({
    title: deal?.title ?? '',
    description: deal?.description ?? '',
    customerId: deal?.customerId ?? '',
    customerName: deal?.customerName ?? '',
    stage: deal?.stage ?? 'lead',
    priority: deal?.priority ?? 'medium',
    source: deal?.source ?? 'referral',
    estimatedValue: deal?.estimatedValue ?? 0,
    currency: deal?.currency ?? CRM_DEFAULT_CURRENCY,
    expectedCloseDate: deal?.expectedCloseDate
      ? (deal.expectedCloseDate.toDate?.() ?? new Date((deal.expectedCloseDate as unknown as { seconds: number }).seconds * 1000))
          .toISOString()
          .split('T')[0]
      : '',
    siteLocation: deal?.siteLocation ?? {},
    tags: deal?.tags ?? [],
    notes: deal?.notes ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title || !values.customerId) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch {
      // Error handling is done by parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof DealFormValues, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{deal ? 'Edit Deal' : 'New Deal'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title *</label>
            <input
              type="text"
              value={values.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Smith Residence Kitchen Renovation"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Customer */}
          <CustomerPicker
            value={
              values.customerId
                ? { customerId: values.customerId, customerName: values.customerName }
                : null
            }
            onChange={(val) => {
              handleChange('customerId', val?.customerId || '');
              handleChange('customerName', val?.customerName || '');
            }}
            label="Customer *"
            placeholder="Search customers..."
          />

          {/* Stage + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={values.stage}
                onChange={(e) => handleChange('stage', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {CRM_ACTIVE_DEAL_STAGES.map((s) => (
                  <option key={s} value={s}>{CRM_DEAL_STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={values.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(DEAL_PRIORITY_LABELS) as DealPriority[]).map((p) => (
                  <option key={p} value={p}>{DEAL_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Source + Currency row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={values.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(DEAL_SOURCE_LABELS) as DealSource[]).map((s) => (
                  <option key={s} value={s}>{DEAL_SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={values.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {CRM_SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Value + Expected Close */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value</label>
              <input
                type="number"
                value={values.estimatedValue || ''}
                onChange={(e) => handleChange('estimatedValue', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close</label>
              <input
                type="date"
                value={values.expectedCloseDate}
                onChange={(e) => handleChange('expectedCloseDate', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={values.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              placeholder="Brief description of the deal..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={values.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              placeholder="Internal notes..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !values.title || !values.customerId}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : deal ? 'Update Deal' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
