/**
 * ProjectPartsLibrary Component
 * Displays and manages project-level special parts
 */

import { useState } from 'react';
import { 
  Package, Trash2, Edit2, ExternalLink, Image, 
  ArrowUpRight, Check, X, Loader2 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectParts } from '../../hooks/useProjectParts';
import type { ProjectPart, PartCategory } from '../../types';

interface ProjectPartsLibraryProps {
  projectId: string;
}

const CATEGORY_LABELS: Record<PartCategory, string> = {
  'handle': 'Handle',
  'lock': 'Lock',
  'hinge': 'Hinge',
  'accessory': 'Accessory',
  'lighting': 'Lighting',
  'drawer-slide': 'Drawer Slide',
  'bracket': 'Bracket',
  'connector': 'Connector',
  'other': 'Other',
};

const CATEGORY_COLORS: Record<PartCategory, string> = {
  'handle': 'bg-blue-100 text-blue-700',
  'lock': 'bg-purple-100 text-purple-700',
  'hinge': 'bg-green-100 text-green-700',
  'accessory': 'bg-amber-100 text-amber-700',
  'lighting': 'bg-yellow-100 text-yellow-700',
  'drawer-slide': 'bg-cyan-100 text-cyan-700',
  'bracket': 'bg-orange-100 text-orange-700',
  'connector': 'bg-pink-100 text-pink-700',
  'other': 'bg-gray-100 text-gray-700',
};

export function ProjectPartsLibrary({ projectId }: ProjectPartsLibraryProps) {
  const { user } = useAuth();
  const { parts, loading, remove, promoteToMaterials, update } = useProjectParts(projectId, user?.uid || '');
  const [editingPart, setEditingPart] = useState<ProjectPart | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (partId: string) => {
    if (!confirm('Delete this part from the project library?')) return;
    setDeletingId(partId);
    try {
      await remove(partId);
    } catch (error) {
      console.error('Failed to delete part:', error);
      alert('Failed to delete part');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePromote = async (partId: string) => {
    if (!confirm('Promote this part to the global materials database? It will be available for all future projects.')) return;
    setPromotingId(partId);
    try {
      const materialId = await promoteToMaterials(partId);
      console.log('Part promoted successfully, material ID:', materialId);
    } catch (error: any) {
      console.error('Failed to promote part:', error);
      alert(`Failed to promote part: ${error?.message || 'Unknown error'}`);
    } finally {
      setPromotingId(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-[#0A7C8E]" />
          <h2 className="text-sm font-semibold text-gray-900">Project Parts Library</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No parts in the library yet</p>
          <p className="text-xs mt-1">Convert clips to parts from the Inspiration section</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#0A7C8E]" />
          <h2 className="text-sm font-semibold text-gray-900">Project Parts Library</h2>
          <span className="bg-[#0A7C8E]/10 text-[#0A7C8E] px-2 py-0.5 rounded-full text-xs font-medium">
            {parts.length} parts
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {parts.map((part) => (
          <div
            key={part.id}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            {/* Image */}
            {part.referenceImageUrl ? (
              <img
                src={part.referenceImageUrl}
                alt={part.name}
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <Image className="w-6 h-6 text-gray-400" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 truncate">{part.name}</h3>
                  <p className="text-xs text-gray-500">{part.supplier}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[part.category]}`}>
                  {CATEGORY_LABELS[part.category]}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(part.unitCost, part.currency)}
                </span>
                {part.partNumber && (
                  <span className="text-xs text-gray-500">SKU: {part.partNumber}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2">
                {part.purchaseUrl && (
                  <a
                    href={part.purchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#0A7C8E] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Source
                  </a>
                )}
                
                {!part.promotedToMaterialId ? (
                  <button
                    onClick={() => handlePromote(part.id)}
                    disabled={promotingId === part.id}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50"
                  >
                    {promotingId === part.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                    Promote to Materials
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="w-3 h-3" />
                    In Materials DB
                  </span>
                )}

                <button
                  onClick={() => setEditingPart(part)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 ml-auto"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                
                <button
                  onClick={() => handleDelete(part.id)}
                  disabled={deletingId === part.id}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === part.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal - simplified inline edit for now */}
      {editingPart && (
        <EditPartModal
          part={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={async (updates) => {
            await update(editingPart.id, updates);
            setEditingPart(null);
          }}
        />
      )}
    </div>
  );
}

interface EditPartModalProps {
  part: ProjectPart;
  onClose: () => void;
  onSave: (updates: Partial<ProjectPart>) => Promise<void>;
}

function EditPartModal({ part, onClose, onSave }: EditPartModalProps) {
  const [name, setName] = useState(part.name);
  const [supplier, setSupplier] = useState(part.supplier);
  const [partNumber, setPartNumber] = useState(part.partNumber || '');
  const [category, setCategory] = useState<PartCategory>(part.category);
  const [unitCost, setUnitCost] = useState(part.unitCost);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, supplier, partNumber: partNumber || undefined, category, unitCost });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Part</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PartCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
