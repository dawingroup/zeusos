/**
 * PromotePartModal Component
 * Modal for promoting a project part to a global inventory item
 */

import { useState } from 'react';
import { X, ArrowUpCircle, Loader2, Package, AlertCircle } from 'lucide-react';
import { promotePartToInventory } from '../services/inventoryService';
import type { InventoryCategory } from '../types';
import { useCategories } from '../hooks/useCategories';

interface ProjectPartData {
  id: string;
  name: string;
  supplier: string;
  partNumber?: string;
  category: string;
  unitCost: number;
  currency: string;
  description?: string;
  referenceImageUrl?: string;
  purchaseUrl?: string;
  specifications?: Record<string, string>;
}

interface PromotePartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromoted: (inventoryItemId: string) => void;
  part: ProjectPartData;
  userId: string;
}

// Map part categories to inventory categories
const CATEGORY_MAP: Record<string, InventoryCategory> = {
  'handle': 'hardware',
  'hinge': 'hardware',
  'lock': 'hardware',
  'drawer-slide': 'hardware',
  'bracket': 'hardware',
  'connector': 'fasteners',
  'lighting': 'hardware',
  'accessory': 'other',
};

export function PromotePartModal({
  isOpen,
  onClose,
  onPromoted,
  part,
  userId,
}: PromotePartModalProps) {
  const { selectableCategories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state with defaults from part
  const [name, setName] = useState(part.name);
  const [category, setCategory] = useState<InventoryCategory>(
    CATEGORY_MAP[part.category] || 'hardware'
  );
  const [description, setDescription] = useState(part.description || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const inventoryItemId = await promotePartToInventory(
        {
          name: name.trim(),
          partNumber: part.partNumber,
          supplier: part.supplier,
          category,
          unitCost: part.unitCost,
          currency: part.currency,
          description: description.trim() || undefined,
          referenceImageUrl: part.referenceImageUrl,
          purchaseUrl: part.purchaseUrl,
          specifications: part.specifications,
        },
        part.id,
        userId
      );

      onPromoted(inventoryItemId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote part');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Promote to Inventory
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Promoting this part will:</p>
              <ul className="mt-1 space-y-0.5 text-blue-700">
                <li>• Add it to the global Inventory</li>
                <li>• Make it available across all projects</li>
                <li>• Track stock and pricing centrally</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Part Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              {part.referenceImageUrl && (
                <img
                  src={part.referenceImageUrl}
                  alt={part.name}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{part.name}</p>
                <p className="text-sm text-gray-500">{part.supplier}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">
                  {part.currency} {part.unitCost.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inventory Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Name in inventory"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inventory Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as InventoryCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-purple-500"
            >
              {selectableCategories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-purple-500 resize-none"
              placeholder="Additional details..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-4 h-4" />
            )}
            Promote to Inventory
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromotePartModal;
