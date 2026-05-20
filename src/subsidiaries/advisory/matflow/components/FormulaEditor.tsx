/**
 * Formula Editor
 * Create and edit formulas with material components
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Search } from 'lucide-react';
import type { StandardFormula, FormulaComponent } from '../types';
import { materialService } from '../services/material-service';
import type { Material } from '../types/material';

interface FormulaEditorProps {
  isOpen: boolean;
  onClose: () => void;
  formula?: StandardFormula | null;
  onSave: (formulaData: FormulaFormData) => Promise<void>;
}

export interface FormulaFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  outputUnit: string;
  components: FormulaComponent[];
}

const FORMULA_CATEGORIES = [
  'Concrete',
  'Masonry',
  'Steelwork',
  'Carpentry',
  'Finishing',
  'Plumbing',
  'Electrical',
  'Other',
];

const UNITS = [
  'm', 'm²', 'm³', 'kg', 'No.', 'Item', 'Lump Sum', 'bags', 'liters',
];

export function FormulaEditor({ isOpen, onClose, formula, onSave }: FormulaEditorProps) {
  const [formData, setFormData] = useState<FormulaFormData>({
    code: '',
    name: '',
    description: '',
    category: 'Concrete',
    subcategory: '',
    outputUnit: 'm³',
    components: [],
  });

  const [materialSearch, setMaterialSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (formula) {
      setFormData({
        code: formula.code,
        name: formula.name,
        description: formula.description || '',
        category: formula.category,
        subcategory: formula.subcategory || '',
        outputUnit: formula.outputUnit,
        components: formula.components || [],
      });
    } else {
      // Reset form for new formula
      setFormData({
        code: '',
        name: '',
        description: '',
        category: 'Concrete',
        subcategory: '',
        outputUnit: 'm³',
        components: [],
      });
    }
  }, [formula, isOpen]);

  const searchMaterials = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await materialService.searchMaterials(searchTerm);
      setSearchResults(results.slice(0, 10));
    } catch (error) {
      console.error('Error searching materials:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addMaterial = (material: Material) => {
    // Check if material already added
    if (formData.components.some(c => c.materialId === material.id)) {
      alert('This material is already in the formula');
      return;
    }

    const newComponent: FormulaComponent = {
      materialId: material.id,
      materialName: material.name,
      quantity: 1,
      unit: material.baseUnit,
      wastagePercent: 5,
    };

    setFormData({
      ...formData,
      components: [...formData.components, newComponent],
    });

    setMaterialSearch('');
    setSearchResults([]);
  };

  const removeComponent = (index: number) => {
    setFormData({
      ...formData,
      components: formData.components.filter((_, i) => i !== index),
    });
  };

  const updateComponent = (index: number, field: keyof FormulaComponent, value: any) => {
    const updated = [...formData.components];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, components: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.components.length === 0) {
      alert('Please add at least one material component to the formula');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving formula:', error);
      alert('Failed to save formula. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {formula ? 'Edit Formula' : 'Create New Formula'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formula Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., C25, BRICK_230"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Unit *
              </label>
              <select
                value={formData.outputUnit}
                onChange={(e) => setFormData({ ...formData, outputUnit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                {UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formula Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Concrete C25/30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this formula is used for..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                {FORMULA_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory
              </label>
              <input
                type="text"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="Optional subcategory"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Material Components */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Material Components (per 1 {formData.outputUnit})
            </h3>

            {/* Search and Add Materials */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Material Library
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={materialSearch}
                  onChange={(e) => {
                    setMaterialSearch(e.target.value);
                    searchMaterials(e.target.value);
                  }}
                  placeholder="Search materials by name or code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Search Results */}
              {materialSearch && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(material => (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => addMaterial(material)}
                        className="w-full text-left px-4 py-2 hover:bg-purple-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">{material.name}</div>
                          <div className="text-xs text-gray-500">
                            {material.code} • {material.category}
                          </div>
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

            {/* Component List */}
            {formData.components.length > 0 ? (
              <div className="space-y-3">
                {formData.components.map((component, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{component.materialName}</h4>
                        <p className="text-sm text-gray-500">Per 1 {formData.outputUnit}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeComponent(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={component.quantity}
                          onChange={(e) => updateComponent(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={component.unit}
                          onChange={(e) => updateComponent(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          required
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
                          value={component.wastagePercent}
                          onChange={(e) => updateComponent(index, 'wastagePercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                <p>No materials added yet</p>
                <p className="text-sm mt-1">Search and add materials from the library above</p>
              </div>
            )}
          </div>

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
              type="submit"
              disabled={isSaving || formData.components.length === 0}
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
                  Save Formula
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
