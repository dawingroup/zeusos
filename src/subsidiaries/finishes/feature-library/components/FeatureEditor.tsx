/**
 * Feature Editor Component
 * Create/edit form for manufacturing features
 */

import { useState } from 'react';
import { X, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import type { 
  ManufacturingFeature, 
  ManufacturingCategory, 
  SkillLevel,
  ProcessStep,
  Equipment,
  MaterialConstraint,
} from '../types';

// ============================================
// Constants
// ============================================

const CATEGORIES: { value: ManufacturingCategory; label: string }[] = [
  { value: 'joinery', label: 'Joinery' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'edge-treatment', label: 'Edge Treatment' },
  { value: 'assembly', label: 'Assembly' },
];

const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'specialist', label: 'Specialist' },
];

// ============================================
// Types
// ============================================

interface FeatureEditorProps {
  feature?: ManufacturingFeature;
  onSave: (feature: Omit<ManufacturingFeature, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

type FormData = Omit<ManufacturingFeature, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================
// Component
// ============================================

export function FeatureEditor({ feature, onSave, onCancel }: FeatureEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState<FormData>(() => ({
    name: feature?.name || '',
    category: feature?.category || 'joinery',
    description: feature?.description || '',
    processSteps: feature?.processSteps || [],
    requiredEquipment: feature?.requiredEquipment || [],
    materialConstraints: feature?.materialConstraints || [],
    qualityCheckpoints: feature?.qualityCheckpoints || [],
    pricingFactors: feature?.pricingFactors || [],
    estimatedTime: feature?.estimatedTime || { min: 10, max: 30, unit: 'minutes' },
    skillLevel: feature?.skillLevel || 'intermediate',
    images: feature?.images || [],
    relatedFeatures: feature?.relatedFeatures || [],
    status: feature?.status || 'active',
    createdBy: feature?.createdBy,
  }));

  // Validation
  const validate = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) {
      newErrors.push('Name is required');
    }
    if (!formData.description.trim()) {
      newErrors.push('Description is required');
    }
    if (formData.processSteps.length === 0) {
      newErrors.push('At least one process step is required');
    }
    if (formData.estimatedTime.min <= 0) {
      newErrors.push('Minimum time must be greater than 0');
    }
    if (formData.estimatedTime.max < formData.estimatedTime.min) {
      newErrors.push('Maximum time must be greater than minimum');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save feature']);
    } finally {
      setIsSaving(false);
    }
  };

  // Process Steps
  const addProcessStep = () => {
    setFormData(prev => ({
      ...prev,
      processSteps: [
        ...prev.processSteps,
        {
          order: prev.processSteps.length + 1,
          name: '',
          description: '',
          duration: 5,
        },
      ],
    }));
  };

  const updateProcessStep = (index: number, updates: Partial<ProcessStep>) => {
    setFormData(prev => ({
      ...prev,
      processSteps: prev.processSteps.map((step, i) =>
        i === index ? { ...step, ...updates } : step
      ),
    }));
  };

  const removeProcessStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      processSteps: prev.processSteps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, order: i + 1 })),
    }));
  };

  // Equipment
  const addEquipment = () => {
    setFormData(prev => ({
      ...prev,
      requiredEquipment: [
        ...prev.requiredEquipment,
        {
          id: `equip-${Date.now()}`,
          name: '',
          type: '',
          isRequired: false,
        },
      ],
    }));
  };

  const updateEquipment = (index: number, updates: Partial<Equipment>) => {
    setFormData(prev => ({
      ...prev,
      requiredEquipment: prev.requiredEquipment.map((equip, i) =>
        i === index ? { ...equip, ...updates } : equip
      ),
    }));
  };

  const removeEquipment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requiredEquipment: prev.requiredEquipment.filter((_, i) => i !== index),
    }));
  };

  // Material Constraints
  const addMaterialConstraint = () => {
    setFormData(prev => ({
      ...prev,
      materialConstraints: [
        ...prev.materialConstraints,
        {
          materialType: '',
        },
      ],
    }));
  };

  const updateMaterialConstraint = (index: number, updates: Partial<MaterialConstraint>) => {
    setFormData(prev => ({
      ...prev,
      materialConstraints: prev.materialConstraints.map((constraint, i) =>
        i === index ? { ...constraint, ...updates } : constraint
      ),
    }));
  };

  const removeMaterialConstraint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materialConstraints: prev.materialConstraints.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {feature ? 'Edit Feature' : 'Create Feature'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Please fix the following errors:</p>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="e.g., Mortise and Tenon Joinery"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ManufacturingCategory }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skill Level</label>
              <select
                value={formData.skillLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, skillLevel: e.target.value as SkillLevel }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {SKILL_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Describe the feature and its purpose..."
              />
            </div>
          </div>

          {/* Estimated Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Time</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={formData.estimatedTime.min}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  estimatedTime: { ...prev.estimatedTime, min: parseInt(e.target.value) || 0 }
                }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                min={1}
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={formData.estimatedTime.max}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  estimatedTime: { ...prev.estimatedTime, max: parseInt(e.target.value) || 0 }
                }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                min={1}
              />
              <select
                value={formData.estimatedTime.unit}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  estimatedTime: { ...prev.estimatedTime, unit: e.target.value as 'minutes' | 'hours' }
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </div>

          {/* Process Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Process Steps <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addProcessStep}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
            </div>
            <div className="space-y-3">
              {formData.processSteps.map((step, index) => (
                <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {step.order}
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateProcessStep(index, { name: e.target.value })}
                      placeholder="Step name"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={step.duration}
                      onChange={(e) => updateProcessStep(index, { duration: parseInt(e.target.value) || 0 })}
                      placeholder="Duration"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min={1}
                    />
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => removeProcessStep(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={step.description}
                      onChange={(e) => updateProcessStep(index, { description: e.target.value })}
                      placeholder="Description"
                      className="col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ))}
              {formData.processSteps.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No process steps yet. Click "Add Step" to begin.
                </p>
              )}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Required Equipment</label>
              <button
                type="button"
                onClick={addEquipment}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add Equipment
              </button>
            </div>
            <div className="space-y-2">
              {formData.requiredEquipment.map((equip, index) => (
                <div key={equip.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={equip.name}
                    onChange={(e) => updateEquipment(index, { name: e.target.value })}
                    placeholder="Equipment name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={equip.type}
                    onChange={(e) => updateEquipment(index, { type: e.target.value })}
                    placeholder="Type"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={equip.isRequired}
                      onChange={(e) => updateEquipment(index, { isRequired: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeEquipment(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Material Constraints */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Material Constraints</label>
              <button
                type="button"
                onClick={addMaterialConstraint}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add Constraint
              </button>
            </div>
            <div className="space-y-2">
              {formData.materialConstraints.map((constraint, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={constraint.materialType}
                    onChange={(e) => updateMaterialConstraint(index, { materialType: e.target.value })}
                    placeholder="Material type"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={constraint.minThickness || ''}
                    onChange={(e) => updateMaterialConstraint(index, { minThickness: parseInt(e.target.value) || undefined })}
                    placeholder="Min mm"
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={constraint.maxThickness || ''}
                    onChange={(e) => updateMaterialConstraint(index, { maxThickness: parseInt(e.target.value) || undefined })}
                    placeholder="Max mm"
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={constraint.grainRequired || false}
                      onChange={(e) => updateMaterialConstraint(index, { grainRequired: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Grain
                  </label>
                  <button
                    type="button"
                    onClick={() => removeMaterialConstraint(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'draft' | 'deprecated' }))}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Feature'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeatureEditor;
