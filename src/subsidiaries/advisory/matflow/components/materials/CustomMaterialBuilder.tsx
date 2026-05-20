/**
 * Custom Material Builder
 * Modal for manually building material lists for items without standard formulas
 */

import { useState } from 'react';
import { X, Plus, Trash2, Calculator, Save } from 'lucide-react';
import type { BOQItem } from '../../types';

interface CustomMaterialBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  boqItem: BOQItem | null;
  onSave: (materials: MaterialEntry[]) => Promise<void>;
}

interface MaterialEntry {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  notes?: string;
}

export function CustomMaterialBuilder({
  isOpen,
  onClose,
  boqItem,
  onSave,
}: CustomMaterialBuilderProps) {
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Placeholder material library - replace with actual service
  const mockMaterials = [
    { id: '1', name: 'Cement (50kg bags)', unit: 'bags', currentRate: 32000 },
    { id: '2', name: 'Sand', unit: 'm³', currentRate: 90000 },
    { id: '3', name: 'Aggregate (20mm)', unit: 'm³', currentRate: 120000 },
    { id: '4', name: 'Bricks (9")', unit: 'No.', currentRate: 350 },
    { id: '5', name: 'Steel Rebar Y12', unit: 'kg', currentRate: 4500 },
  ];

  const addMaterial = (material: typeof mockMaterials[0]) => {
    const newEntry: MaterialEntry = {
      materialId: material.id,
      materialName: material.name,
      quantity: 1,
      unit: material.unit,
      wastagePercent: 5,
    };
    setMaterials([...materials, newEntry]);
    setSearchTerm('');
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof MaterialEntry, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const calculateTotals = () => {
    const boqQty = boqItem?.quantityContract || boqItem?.quantity || 1;
    return materials.map(m => ({
      ...m,
      totalQuantity: m.quantity * boqQty * (1 + m.wastagePercent / 100),
    }));
  };

  const handleSave = async () => {
    if (materials.length === 0) {
      alert('Please add at least one material');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(materials);
      onClose();
      setMaterials([]);
    } catch (error) {
      console.error('Error saving custom materials:', error);
      alert('Failed to save materials. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !boqItem) return null;

  const filteredMaterials = mockMaterials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-purple-600" />
              Custom Material List
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {boqItem.hierarchyPath || boqItem.itemNumber} - {boqItem.description}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* BOQ Item Info */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-purple-700 font-medium">Quantity:</span>{' '}
                <span className="text-purple-900">{boqItem.quantityContract || boqItem.quantity}</span>
              </div>
              <div>
                <span className="text-purple-700 font-medium">Unit:</span>{' '}
                <span className="text-purple-900">{boqItem.unit}</span>
              </div>
              <div>
                <span className="text-purple-700 font-medium">Materials will be per:</span>{' '}
                <span className="text-purple-900">1 {boqItem.unit}</span>
              </div>
            </div>
          </div>

          {/* Add Material */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Material Library
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search materials..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchTerm && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredMaterials.length > 0 ? (
                  filteredMaterials.map(material => (
                    <button
                      key={material.id}
                      onClick={() => addMaterial(material)}
                      className="w-full text-left px-4 py-2 hover:bg-purple-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">{material.name}</div>
                        <div className="text-xs text-gray-500">Unit: {material.unit}</div>
                      </div>
                      <Plus className="w-4 h-4 text-purple-600" />
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">No materials found</div>
                )}
              </div>
            )}
          </div>

          {/* Material List */}
          {materials.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Material Requirements</h3>
              <div className="space-y-3">
                {materials.map((material, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{material.materialName}</h4>
                        <p className="text-sm text-gray-500">Per {boqItem.unit}</p>
                      </div>
                      <button
                        onClick={() => removeMaterial(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Quantity per unit
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={material.quantity}
                          onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Wastage %
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={material.wastagePercent}
                          onChange={(e) => updateMaterial(index, 'wastagePercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Total for project
                        </label>
                        <div className="px-2 py-1.5 text-sm bg-white border border-gray-200 rounded font-medium text-gray-900">
                          {totals[index].totalQuantity.toFixed(2)} {material.unit}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={material.notes || ''}
                        onChange={(e) => updateMaterial(index, 'notes', e.target.value)}
                        placeholder="Add notes about this material..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {materials.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No materials added yet</p>
              <p className="text-sm mt-1">Search and add materials from the library above</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={materials.length === 0 || isSaving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Material List
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
