/**
 * DesignOptionCreator Component
 * Dialog for team members to create/edit design options with inspirations
 */

import { useState, useCallback } from 'react';
import {
  X,
  Upload,
  Link2,
  Sparkles,
  Trash2,
  GripVertical,
  Star,
  Loader2,
} from 'lucide-react';
import { ManualUploadDialog } from '@/subsidiaries/finishes/clipper/components/ManualUploadDialog';
import type {
  DesignOption,
  DesignOptionFormData,
  DesignOptionInspiration,
  DesignOptionCategory,
} from '../../types/designOptions';

interface DesignOptionCreatorProps {
  projectId: string;
  designItemId?: string;
  designItemName?: string;
  existingOption?: DesignOption;
  onSave: (data: DesignOptionFormData) => Promise<void>;
  onSubmit?: (data: DesignOptionFormData) => Promise<void>;
  onClose: () => void;
}

const CATEGORY_OPTIONS: { value: DesignOptionCategory; label: string }[] = [
  { value: 'material', label: 'Material' },
  { value: 'finish', label: 'Finish' },
  { value: 'style', label: 'Style' },
  { value: 'layout', label: 'Layout' },
  { value: 'feature', label: 'Feature' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

export function DesignOptionCreator({
  projectId,
  designItemId,
  designItemName,
  existingOption,
  onSave,
  onSubmit,
  onClose,
}: DesignOptionCreatorProps) {
  const [name, setName] = useState(existingOption?.name || '');
  const [description, setDescription] = useState(existingOption?.description || '');
  const [category, setCategory] = useState<DesignOptionCategory>(
    existingOption?.category || 'style'
  );
  const [inspirations, setInspirations] = useState<DesignOptionInspiration[]>(
    existingOption?.inspirations || []
  );
  const [estimatedCost, setEstimatedCost] = useState<string>(
    existingOption?.estimatedCost?.toString() || ''
  );
  const [currency, setCurrency] = useState(existingOption?.currency || 'UGX');
  const [isRecommended, setIsRecommended] = useState(existingOption?.isRecommended || false);
  const [comparisonNotes, setComparisonNotes] = useState(existingOption?.comparisonNotes || '');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleClipCreated = useCallback((clipId: string) => {
    // The clip will be fetched and added via the service
    // For now, we'll add a placeholder that gets updated
    const newInspiration: DesignOptionInspiration = {
      id: clipId,
      clipId,
      imageUrl: '', // Will be updated when dialog closes
      title: 'New Upload',
      isManualUpload: true,
      order: inspirations.length,
    };
    setInspirations((prev) => [...prev, newInspiration]);
  }, [inspirations.length]);

  const handleRemoveInspiration = useCallback((inspirationId: string) => {
    setInspirations((prev) =>
      prev.filter((insp) => insp.id !== inspirationId).map((insp, i) => ({ ...insp, order: i }))
    );
  }, []);

  const getFormData = useCallback((): DesignOptionFormData => {
    return {
      name,
      description: description || undefined,
      category,
      inspirations,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      currency,
      isRecommended,
      comparisonNotes: comparisonNotes || undefined,
    };
  }, [name, description, category, inspirations, estimatedCost, currency, isRecommended, comparisonNotes]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(getFormData());
      onClose();
    } catch (error) {
      console.error('Failed to save design option:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(getFormData());
      onClose();
    } catch (error) {
      console.error('Failed to submit design option:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {existingOption ? 'Edit Design Option' : 'Create Design Option'}
            </h2>
            {designItemName && (
              <p className="text-xs text-gray-500 mt-0.5">For: {designItemName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Option Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Walnut with Natural Finish"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DesignOptionCategory)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent bg-white"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this design option..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent resize-none"
            />
          </div>

          {/* Inspirations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inspirations
            </label>

            {inspirations.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-3">
                {inspirations.map((insp) => (
                  <div
                    key={insp.id}
                    className="relative group rounded-lg overflow-hidden border border-gray-200"
                  >
                    <div className="aspect-square bg-gray-100">
                      {insp.imageUrl ? (
                        <img
                          src={insp.thumbnailUrl || insp.imageUrl}
                          alt={insp.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {insp.title}
                      </p>
                      {insp.aiAnalysis && (
                        <div className="flex items-center gap-1 mt-1">
                          <Sparkles className="w-3 h-3 text-purple-500" />
                          <span className="text-[10px] text-purple-600">AI Analyzed</span>
                        </div>
                      )}
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveInspiration(insp.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                    {/* Drag handle */}
                    <div className="absolute top-2 left-2 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                      <GripVertical className="w-3 h-3 text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Photo
              </button>
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-400 cursor-not-allowed"
              >
                <Link2 className="w-4 h-4" />
                Link Clip
              </button>
            </div>
          </div>

          {/* Estimated Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Cost
              </label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent bg-white"
              >
                <option value="UGX">UGX</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Recommended */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRecommended(!isRecommended)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                isRecommended
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Star className={`w-4 h-4 ${isRecommended ? 'fill-yellow-500' : ''}`} />
              {isRecommended ? 'Recommended' : 'Mark as Recommended'}
            </button>
          </div>

          {/* Comparison Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comparison Notes
            </label>
            <textarea
              value={comparisonNotes}
              onChange={(e) => setComparisonNotes(e.target.value)}
              placeholder="Notes for comparing this option with alternatives..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Draft
            </button>
            {onSubmit && (
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit for Approval
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Upload Dialog */}
      <ManualUploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        projectId={projectId}
        designItemId={designItemId}
        onClipCreated={handleClipCreated}
      />
    </div>
  );
}

export default DesignOptionCreator;
