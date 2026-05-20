/**
 * Feature Form Component
 * Create/Edit form for manufacturing features
 */

import { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import type { FeatureLibraryItem, FeatureFormData, ProcessStep, FeatureCategory } from '../../types/featureLibrary';
import { CATEGORY_LABELS, QUALITY_GRADE_LABELS, STATUS_LABELS, DEFAULT_FEATURE } from '../../types/featureLibrary';

interface FeatureFormProps {
  feature?: FeatureLibraryItem;
  onSubmit: (data: FeatureFormData) => Promise<void>;
  onCancel: () => void;
}

export function FeatureForm({ feature, onSubmit, onCancel }: FeatureFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FeatureFormData>({
    name: feature?.name || '',
    description: feature?.description || '',
    category: feature?.category || 'joinery',
    subcategory: feature?.subcategory || '',
    tags: feature?.tags || [],
    processSteps: feature?.processSteps || [],
    estimatedTime: feature?.estimatedTime || DEFAULT_FEATURE.estimatedTime,
    costFactors: feature?.costFactors || DEFAULT_FEATURE.costFactors,
    requiredEquipment: feature?.requiredEquipment || [],
    requiredMaterials: feature?.requiredMaterials || [],
    qualityGrade: feature?.qualityGrade || 'custom',
    inspectionPoints: feature?.inspectionPoints || [],
    status: feature?.status || 'active',
  });

  const [newTag, setNewTag] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const addEquipment = () => {
    if (newEquipment.trim() && !formData.requiredEquipment.includes(newEquipment.trim())) {
      setFormData({ ...formData, requiredEquipment: [...formData.requiredEquipment, newEquipment.trim()] });
      setNewEquipment('');
    }
  };

  const removeEquipment = (item: string) => {
    setFormData({ ...formData, requiredEquipment: formData.requiredEquipment.filter(e => e !== item) });
  };

  const addProcessStep = () => {
    const newStep: ProcessStep = {
      order: formData.processSteps.length + 1,
      name: '',
      description: '',
      duration: 15,
    };
    setFormData({ ...formData, processSteps: [...formData.processSteps, newStep] });
  };

  const updateProcessStep = (index: number, updates: Partial<ProcessStep>) => {
    const steps = [...formData.processSteps];
    steps[index] = { ...steps[index], ...updates };
    setFormData({ ...formData, processSteps: steps });
  };

  const removeProcessStep = (index: number) => {
    const steps = formData.processSteps.filter((_, i) => i !== index);
    // Reorder
    steps.forEach((step, i) => step.order = i + 1);
    setFormData({ ...formData, processSteps: steps });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {feature ? 'Edit Feature' : 'Add New Feature'}
          </h2>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., Mortise and Tenon Joint"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as FeatureCategory })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                <input
                  type="text"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., Traditional Joinery"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Describe this manufacturing feature..."
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-sm">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Add a tag..."
              />
              <button type="button" onClick={addTag} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                Add
              </button>
            </div>
          </div>

          {/* Quality & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quality Grade</label>
              <select
                value={formData.qualityGrade}
                onChange={(e) => setFormData({ ...formData, qualityGrade: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {Object.entries(QUALITY_GRADE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skill Level</label>
              <select
                value={formData.costFactors.skillLevel}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  costFactors: { ...formData.costFactors, skillLevel: e.target.value as any } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="apprentice">Apprentice</option>
                <option value="journeyman">Journeyman</option>
                <option value="master">Master</option>
              </select>
            </div>
          </div>

          {/* Time Estimates */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Time Estimates (hours)</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimatedTime.minimum}
                  onChange={(e) => setFormData({
                    ...formData,
                    estimatedTime: { ...formData.estimatedTime, minimum: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Typical</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimatedTime.typical}
                  onChange={(e) => setFormData({
                    ...formData,
                    estimatedTime: { ...formData.estimatedTime, typical: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimatedTime.maximum}
                  onChange={(e) => setFormData({
                    ...formData,
                    estimatedTime: { ...formData.estimatedTime, maximum: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Required Equipment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Required Equipment</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.requiredEquipment.map((item) => (
                <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  {item}
                  <button type="button" onClick={() => removeEquipment(item)} className="text-blue-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEquipment())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Add equipment..."
              />
              <button type="button" onClick={addEquipment} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                Add
              </button>
            </div>
          </div>

          {/* Process Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Process Steps</label>
              <button
                type="button"
                onClick={addProcessStep}
                className="flex items-center gap-1 px-2 py-1 text-sm text-primary hover:bg-primary/10 rounded"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
            </div>
            <div className="space-y-2">
              {formData.processSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-grab" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateProcessStep(index, { name: e.target.value })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Step name"
                      />
                      <input
                        type="number"
                        value={step.duration}
                        onChange={(e) => updateProcessStep(index, { duration: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Min"
                      />
                    </div>
                    <input
                      type="text"
                      value={step.description}
                      onChange={(e) => updateProcessStep(index, { description: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      placeholder="Step description"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProcessStep(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {formData.processSteps.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No process steps yet</p>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : feature ? 'Update Feature' : 'Create Feature'}
          </button>
        </div>
      </div>
    </div>
  );
}
