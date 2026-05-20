/**
 * Edit Offcut Dialog
 *
 * Modal form for editing offcut details (dimensions, condition, warehouse, notes).
 * Read-only display for material type/name, source project, status, and dates.
 */

import { useState, useEffect } from 'react';
import { X, Loader2, Save, Pencil } from 'lucide-react';
import type { Offcut } from '@/shared/types/offcut';
import type { OffcutCondition } from '@/shared/types/offcut';
import { updateOffcutDetails } from '@/shared/services/offcutLibraryService';

interface EditOffcutDialogProps {
  open: boolean;
  offcut: Offcut;
  onClose: () => void;
  onSaved: () => void;
}

const CONDITIONS: { value: OffcutCondition; label: string; color: string }[] = [
  { value: 'good', label: 'Good', color: 'bg-green-100 text-green-700' },
  { value: 'fair', label: 'Fair', color: 'bg-amber-100 text-amber-700' },
  { value: 'damaged', label: 'Damaged', color: 'bg-red-100 text-red-700' },
];

function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  // Firestore Timestamp
  if (ts && typeof ts === 'object' && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (ts instanceof Date) return ts.toLocaleDateString();
  return '—';
}

export function EditOffcutDialog({ open, offcut, onClose, onSaved }: EditOffcutDialogProps) {
  const [length, setLength] = useState(offcut.length);
  const [width, setWidth] = useState(offcut.width);
  const [thickness, setThickness] = useState(offcut.thickness);
  const [condition, setCondition] = useState<OffcutCondition>(offcut.condition);
  const [warehouseLocation, setWarehouseLocation] = useState(offcut.warehouseLocation || '');
  const [notes, setNotes] = useState(offcut.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLength(offcut.length);
    setWidth(offcut.width);
    setThickness(offcut.thickness);
    setCondition(offcut.condition);
    setWarehouseLocation(offcut.warehouseLocation || '');
    setNotes(offcut.notes || '');
    setError(null);
  }, [offcut]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateOffcutDetails(offcut.id, {
        length,
        width,
        thickness,
        condition,
        warehouseLocation: warehouseLocation || undefined,
        notes: notes || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update offcut');
    } finally {
      setSaving(false);
    }
  };

  const statusColor = {
    available: 'bg-green-100 text-green-700',
    reserved: 'bg-blue-100 text-blue-700',
    used: 'bg-gray-100 text-gray-600',
    scrapped: 'bg-red-100 text-red-700',
  }[offcut.status] || 'bg-gray-100 text-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Offcut</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Read-only Info */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{offcut.materialName}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                {offcut.status}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Type: {offcut.materialType}
            </div>
            <div className="text-xs text-gray-500">
              Source: {offcut.sourceProjectName}
            </div>
            <div className="text-xs text-gray-500">
              Created: {formatTimestamp(offcut.createdAt)}
            </div>
            {offcut.reservedForProjectId && (
              <div className="text-xs text-blue-600">
                Reserved for: {offcut.reservedForProjectId} ({formatTimestamp(offcut.reservedAt)})
              </div>
            )}
            {offcut.usedInProjectId && (
              <div className="text-xs text-gray-600">
                Used in: {offcut.usedInProjectId} ({formatTimestamp(offcut.usedAt)})
              </div>
            )}
            {offcut.scrappedReason && (
              <div className="text-xs text-red-600">
                Scrapped: {offcut.scrappedReason} ({formatTimestamp(offcut.scrappedAt)})
              </div>
            )}
            <div className="text-xs text-gray-500">
              Value: {offcut.originalCostAllocation.toLocaleString()} UGX
            </div>
          </div>

          {/* Editable Dimensions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dimensions (mm)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500">Length</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  min={0}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Width</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  min={0}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Thickness</label>
                <input
                  type="number"
                  value={thickness}
                  onChange={(e) => setThickness(Number(e.target.value))}
                  min={0}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Condition
            </label>
            <div className="flex gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                    condition === c.value
                      ? `${c.color} border-current`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Warehouse Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warehouse Location
            </label>
            <input
              type="text"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
              placeholder="e.g., Bay A, Shelf 3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes about this offcut..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditOffcutDialog;
