/**
 * RAG Edit Modal
 * Modal for editing a single RAG aspect's status and notes
 */

import { useState } from 'react';
import { X, Circle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { RAGStatusValue, RAGValue, RAGStatus } from '../../types';

export interface RAGEditModalProps {
  open: boolean;
  category: keyof RAGStatus;
  aspectKey: string;
  aspectLabel: string;
  currentValue: RAGValue;
  onSave: (status: RAGStatusValue, notes: string) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: RAGStatusValue; label: string; color: string }[] = [
  { value: 'green', label: 'Green - Complete', color: 'bg-green-500' },
  { value: 'amber', label: 'Amber - In Progress', color: 'bg-amber-500' },
  { value: 'red', label: 'Red - Not Started / Blocked', color: 'bg-red-500' },
  { value: 'not-applicable', label: 'N/A - Not Applicable', color: 'bg-gray-400' },
];

export function RAGEditModal({
  open,
  aspectLabel,
  currentValue,
  onSave,
  onClose,
}: RAGEditModalProps) {
  const [status, setStatus] = useState<RAGStatusValue>(currentValue.status);
  const [notes, setNotes] = useState(currentValue.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(status, notes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Update: {aspectLabel}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                    status === option.value
                      ? 'border-[#1d1d1f] bg-[#1d1d1f]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <Circle
                    className={cn('w-4 h-4', option.color)}
                    fill="currentColor"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent resize-none"
              placeholder="Add any relevant notes or comments..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg',
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#1d1d1f] hover:bg-[#424245]'
            )}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RAGEditModal;
