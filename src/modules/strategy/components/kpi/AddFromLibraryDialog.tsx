/**
 * Add From Library Dialog
 * Dialog to configure and add a KPI from the library to active tracking.
 */

import { useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import {
  KPI_SCOPE,
  KPI_SCOPE_LABELS,
  KPI_FREQUENCY_LABELS,
  KPI_DIRECTION_LABELS,
  KPI_CATEGORY_LABELS,
  type KPIScope,
} from '../../constants/kpi.constants';
import type { KPILibraryEntry } from '../../constants/kpiLibrary.constants';
import type { CreateKPIInput } from '../../types/kpi.types';

interface AddFromLibraryDialogProps {
  entry: KPILibraryEntry;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: CreateKPIInput) => Promise<void>;
}

export function AddFromLibraryDialog({ entry, isOpen, onClose, onAdd }: AddFromLibraryDialogProps) {
  const [targetValue, setTargetValue] = useState('');
  const [stretchValue, setStretchValue] = useState('');
  const [minimumValue, setMinimumValue] = useState('');
  const [scope, setScope] = useState<KPIScope>(KPI_SCOPE.GROUP);
  const [ownerName, setOwnerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetValue) {
      setError('Target value is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: CreateKPIInput = {
        libraryEntryId: entry.id,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        type: entry.type,
        scope,
        ownerId: '',
        ownerName: ownerName || undefined,
        unit: entry.unit,
        direction: entry.direction,
        frequency: entry.frequency,
        target: {
          value: parseFloat(targetValue),
          ...(stretchValue ? { stretchValue: parseFloat(stretchValue) } : {}),
          ...(minimumValue ? { minimumValue: parseFloat(minimumValue) } : {}),
        },
        dataSourceType: entry.moduleLinkage?.autoComputable ? 'calculated' : 'manual',
        bscPerspective: entry.bscPerspective,
        tags: entry.tags,
        isPublic: true,
      };

      await onAdd(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add KPI');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add KPI to Tracking</h2>
              <p className="text-sm text-gray-500">Configure and start tracking this KPI</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Info */}
        <div className="p-5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-gray-400 bg-white px-1.5 py-0.5 rounded border">
              {entry.code}
            </span>
            <span className="text-xs text-gray-500">
              {KPI_CATEGORY_LABELS[entry.category]}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">{entry.name}</h3>
          <p className="text-sm text-gray-600 mb-2">{entry.description}</p>
          <div className="bg-white rounded-md px-3 py-2 border border-gray-200">
            <p className="text-xs text-gray-400 font-medium mb-0.5">Formula</p>
            <p className="text-xs text-gray-700 font-mono">{entry.formula}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Pre-filled read-only info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Direction</label>
              <p className="text-sm text-gray-700">{KPI_DIRECTION_LABELS[entry.direction]}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
              <p className="text-sm text-gray-700">{KPI_FREQUENCY_LABELS[entry.frequency]}</p>
            </div>
          </div>

          {/* Target value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Value <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Enter target value"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {entry.unit && (
                <span className="text-sm text-gray-500 font-medium">{entry.unit}</span>
              )}
            </div>
          </div>

          {/* Stretch & Minimum targets */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stretch Target
              </label>
              <input
                type="number"
                step="any"
                value={stretchValue}
                onChange={(e) => setStretchValue(e.target.value)}
                placeholder="Aspirational"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Ambitious goal</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Acceptable
              </label>
              <input
                type="number"
                step="any"
                value={minimumValue}
                onChange={(e) => setMinimumValue(e.target.value)}
                placeholder="Floor threshold"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Below this = critical</p>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as KPIScope)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(KPI_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Who is responsible for this KPI?"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add to Tracking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
