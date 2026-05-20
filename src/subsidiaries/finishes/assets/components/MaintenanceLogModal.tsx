/**
 * Maintenance Log Modal Component
 * Prompts user to log maintenance issue when status changes to MAINTENANCE
 */

import { useState } from 'react';
import type { Asset } from '@/shared/types';
import type { MaintenanceLog } from '../types';

interface MaintenanceLogModalProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (logEntry: Omit<MaintenanceLog, 'id' | 'performedAt' | 'assetId'>) => Promise<void>;
}

const MAINTENANCE_TYPES = [
  { value: 'SCHEDULED', label: 'Scheduled Maintenance' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'CALIBRATION', label: 'Calibration' },
] as const;

export function MaintenanceLogModal({ 
  asset, 
  isOpen, 
  onClose, 
  onSubmit 
}: MaintenanceLogModalProps) {
  const [type, setType] = useState<MaintenanceLog['type']>('REPAIR');
  const [description, setDescription] = useState('');
  const [tasksCompleted, setTasksCompleted] = useState<string[]>([]);
  const [hoursAtService, setHoursAtService] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        type,
        description,
        tasksCompleted,
        hoursAtService,
        notes: notes || undefined,
        performedBy: '', // Will be set by the service
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTask = (task: string) => {
    if (tasksCompleted.includes(task)) {
      setTasksCompleted(tasksCompleted.filter(t => t !== task));
    } else {
      setTasksCompleted([...tasksCompleted, task]);
    }
  };

  const displayName = asset.nickname || `${asset.brand} ${asset.model}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Log Maintenance Issue
              </h3>
              <p className="text-sm text-gray-500">{displayName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maintenance Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MaintenanceLog['type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Describe the issue or maintenance being performed..."
                required
              />
            </div>

            {/* Tasks from maintenance checklist */}
            {asset.maintenance?.tasks && asset.maintenance.tasks.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Tasks
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {asset.maintenance.tasks.map((task, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={tasksCompleted.includes(task)}
                        onChange={() => toggleTask(task)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{task}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Operating Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operating Hours at Service
              </label>
              <input
                type="number"
                value={hoursAtService}
                onChange={(e) => setHoursAtService(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Estimated hours the tool has been in operation
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Any additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Logging...' : 'Log & Set to Maintenance'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
