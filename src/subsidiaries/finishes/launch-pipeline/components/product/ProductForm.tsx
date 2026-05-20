/**
 * Product Form Component
 * Create/edit form with extended fields for specifications
 */

import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import type { LaunchProduct, ProductCategory, ProductSpecifications } from '../../types/product.types';
import type { PipelineStage } from '../../types/stage.types';

interface ProductFormProps {
  product?: LaunchProduct;
  onSubmit: (data: Partial<LaunchProduct>) => Promise<void>;
  onClose: () => void;
}

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'casework', label: 'Casework' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'millwork', label: 'Millwork' },
  { value: 'doors', label: 'Doors' },
  { value: 'fixtures', label: 'Fixtures' },
  { value: 'specialty', label: 'Specialty' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function ProductForm({ product, onSubmit, onClose }: ProductFormProps) {
  const isEditing = !!product;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || 'furniture' as ProductCategory,
    currentStage: product?.currentStage || 'idea' as PipelineStage,
    priority: product?.priority || 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    notes: product?.notes || '',
    tags: product?.tags?.join(', ') || '',
    // Specifications
    materials: product?.specifications?.materials?.join(', ') || '',
    finishes: product?.specifications?.finishes?.join(', ') || '',
    colors: product?.specifications?.colors?.join(', ') || '',
    features: product?.specifications?.features?.join(', ') || '',
    // Dimensions
    length: product?.specifications?.dimensions?.length?.toString() || '',
    width: product?.specifications?.dimensions?.width?.toString() || '',
    height: product?.specifications?.dimensions?.height?.toString() || '',
    dimensionUnit: product?.specifications?.dimensions?.unit || 'cm' as 'mm' | 'cm' | 'in',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const specifications: ProductSpecifications = {
        materials: formData.materials.split(',').map(s => s.trim()).filter(Boolean),
        finishes: formData.finishes.split(',').map(s => s.trim()).filter(Boolean),
        colors: formData.colors.split(',').map(s => s.trim()).filter(Boolean),
        features: formData.features.split(',').map(s => s.trim()).filter(Boolean),
      };

      if (formData.length && formData.width && formData.height) {
        specifications.dimensions = {
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
          unit: formData.dimensionUnit,
        };
      }

      await onSubmit({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        currentStage: formData.currentStage,
        priority: formData.priority,
        notes: formData.notes,
        tags: formData.tags.split(',').map(s => s.trim()).filter(Boolean),
        specifications,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Modern Oak Console Table"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={3}
                placeholder="Brief product description..."
              />
            </div>
          </div>

          {/* Specifications */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Specifications</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Materials (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.materials}
                  onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Oak, Steel, Glass"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Finishes (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.finishes}
                  onChange={(e) => setFormData({ ...formData, finishes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Matte, Lacquered"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Colors (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.colors}
                  onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Natural Oak, Black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Soft-close, Adjustable shelves"
                />
              </div>
            </div>
          </div>

          {/* Tags & Notes */}
          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="new, featured, bestseller"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Internal notes..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
