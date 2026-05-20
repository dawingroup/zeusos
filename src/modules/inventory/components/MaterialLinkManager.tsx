/**
 * MaterialLinkManager Component
 * Shows materials linked to an inventory item with unlink actions
 */

import { useState, useEffect } from 'react';
import { Link2Off, Loader2, Layers, ExternalLink } from 'lucide-react';
import { getMaterialsLinkedToInventory } from '../services/materialInventoryLinkService';
import type { MaterialTier } from '@/modules/design-manager/types/materials';

interface LinkedMaterial {
  materialId: string;
  tier: MaterialTier;
  name: string;
}

interface MaterialLinkManagerProps {
  inventoryItemId: string;
  linkedMaterialIds?: string[];
  onUnlink?: (materialId: string, tier: MaterialTier) => Promise<void>;
  disabled?: boolean;
}

const TIER_STYLES: Record<MaterialTier, { label: string; bgColor: string; textColor: string }> = {
  global: { label: 'Global', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  customer: { label: 'Customer', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
  project: { label: 'Project', bgColor: 'bg-green-100', textColor: 'text-green-700' },
};

export function MaterialLinkManager({
  inventoryItemId,
  linkedMaterialIds = [],
  onUnlink,
  disabled = false,
}: MaterialLinkManagerProps) {
  const [materials, setMaterials] = useState<LinkedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inventoryItemId && linkedMaterialIds.length > 0) {
      loadLinkedMaterials();
    } else {
      setMaterials([]);
      setLoading(false);
    }
  }, [inventoryItemId, linkedMaterialIds]);

  const loadLinkedMaterials = async () => {
    setLoading(true);
    setError(null);
    try {
      const linked = await getMaterialsLinkedToInventory(inventoryItemId);
      setMaterials(linked);
    } catch (err) {
      setError('Failed to load linked materials');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (material: LinkedMaterial) => {
    if (!onUnlink) return;
    if (!confirm(`Unlink "${material.name}" from this inventory item?`)) return;

    setUnlinkingId(material.materialId);
    setError(null);

    try {
      await onUnlink(material.materialId, material.tier);
      // Remove from local state
      setMaterials((prev) => prev.filter((m) => m.materialId !== material.materialId));
    } catch (err) {
      setError('Failed to unlink material');
      console.error(err);
    } finally {
      setUnlinkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Linked Materials
        </h3>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Linked Materials
        </h3>
        <span className="text-xs text-gray-500">{materials.length} linked</span>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {materials.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <Layers className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <p>No materials linked to this inventory item.</p>
          <p className="text-xs mt-1">
            Link materials from the Materials Library to sync pricing and stock information.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((material) => {
            const tierStyle = TIER_STYLES[material.tier];
            return (
              <div
                key={material.materialId}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {material.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${tierStyle.bgColor} ${tierStyle.textColor}`}
                      >
                        {tierStyle.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">ID: {material.materialId.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-gray-100"
                    title="View in Materials Library"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  {onUnlink && (
                    <button
                      type="button"
                      onClick={() => handleUnlink(material)}
                      disabled={disabled || unlinkingId === material.materialId}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                      title="Unlink material"
                    >
                      {unlinkingId === material.materialId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2Off className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MaterialLinkManager;
