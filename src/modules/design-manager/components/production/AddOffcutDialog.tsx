/**
 * Add Offcut Dialog
 *
 * Form dialog for manually registering offcuts into the library.
 * Used when users have leftover material from job sites,
 * purchased remnants, or other non-production sources.
 */

import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import type { MaterialType } from '@/shared/types';
import type { OffcutCondition } from '@/shared/types/offcut';
import { registerManualOffcut } from '@/shared/services/offcutLibraryService';

interface AddOffcutDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (offcutId: string) => void;
  /** Pre-fill material type when opened from a context that knows it */
  defaultMaterialType?: MaterialType;
  /** Pre-fill material name */
  defaultMaterialName?: string;
}

const MATERIAL_TYPE_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: 'TIMBER', label: 'Timber' },
  { value: 'PANEL', label: 'Panel / Board' },
  { value: 'GLASS', label: 'Glass' },
  { value: 'METAL_BAR', label: 'Metal Bar' },
  { value: 'ALUMINIUM', label: 'Aluminium' },
  { value: 'STONE', label: 'Stone' },
];

const CONDITION_OPTIONS: { value: OffcutCondition; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
];

export const AddOffcutDialog: React.FC<AddOffcutDialogProps> = ({
  open,
  onClose,
  onCreated,
  defaultMaterialType,
  defaultMaterialName,
}) => {
  const [materialType, setMaterialType] = useState<MaterialType>(defaultMaterialType || 'PANEL');
  const [materialName, setMaterialName] = useState(defaultMaterialName || '');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [thickness, setThickness] = useState('');
  const [isDressed, setIsDressed] = useState(true);
  const [condition, setCondition] = useState<OffcutCondition>('good');
  const [costAllocation, setCostAllocation] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [sourceDescription, setSourceDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isTimber = materialType === 'TIMBER';
  const isLinear = materialType === 'METAL_BAR' || materialType === 'ALUMINIUM';

  const handleSubmit = async () => {
    // Validation
    if (!materialName.trim()) {
      setError('Material name is required');
      return;
    }
    if (!length || Number(length) <= 0) {
      setError('Length must be greater than 0');
      return;
    }
    if (!width || Number(width) <= 0) {
      setError('Width must be greater than 0');
      return;
    }
    if (!thickness || Number(thickness) <= 0) {
      setError('Thickness must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const crossSection = isTimber
        ? { thickness: Number(thickness), width: Number(width) }
        : undefined;

      const id = await registerManualOffcut({
        materialType,
        materialName: materialName.trim(),
        length: Number(length),
        width: Number(width),
        thickness: Number(thickness),
        crossSection,
        isDressed: isTimber ? isDressed : undefined,
        condition,
        originalCostAllocation: Number(costAllocation) || 0,
        warehouseLocation: warehouseLocation.trim() || undefined,
        notes: notes.trim() || undefined,
        sourceDescription: sourceDescription.trim() || undefined,
      });

      onCreated(id);
    } catch (err) {
      console.error('Failed to register offcut:', err);
      setError('Failed to register offcut. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Register Offcut</h3>
            <p className="text-sm text-gray-500">Add a remnant to the offcut library</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Material Type & Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
              >
                {MATERIAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material Name *</label>
              <input
                type="text"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="e.g. 18mm White Melamine"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
              />
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isTimber ? 'Dimensions (Cross-section & Length)' :
               isLinear ? 'Dimensions (Profile & Length)' :
               'Dimensions (L × W × T)'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {isTimber ? (
                <>
                  <div>
                    <span className="text-xs text-gray-500">Thickness (mm)</span>
                    <input
                      type="number"
                      value={thickness}
                      onChange={(e) => setThickness(e.target.value)}
                      placeholder="38"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Width (mm)</span>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      placeholder="114"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Length (mm)</span>
                    <input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="1200"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-gray-500">Length (mm)</span>
                    <input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="2440"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Width (mm)</span>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      placeholder="600"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Thickness (mm)</span>
                    <input
                      type="number"
                      value={thickness}
                      onChange={(e) => setThickness(e.target.value)}
                      placeholder="18"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Timber: isDressed toggle */}
          {isTimber && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDressed}
                onChange={(e) => setIsDressed(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700">Dressed / PAR (planed all round)</span>
            </label>
          )}

          {/* Condition & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as OffcutCondition)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value (UGX)</label>
              <input
                type="number"
                value={costAllocation}
                onChange={(e) => setCostAllocation(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Location</label>
            <input
              type="text"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
              placeholder="e.g. Rack B, Shelf 3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          </div>

          {/* Source Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input
              type="text"
              value={sourceDescription}
              onChange={(e) => setSourceDescription(e.target.value)}
              placeholder="e.g. Leftover from Kampala office job"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Register Offcut
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddOffcutDialog;
