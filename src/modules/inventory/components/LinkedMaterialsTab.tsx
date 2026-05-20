/**
 * LinkedMaterialsTab Component
 * Displays materials from the palette library linked to an inventory item.
 * Supports linking new materials and unlinking existing ones.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Palette,
  Link2,
  Unlink,
  Loader2,
  Plus,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  getFullMaterialsLinkedToInventory,
  linkMaterialToInventory,
  unlinkMaterialFromInventory,
} from '../services/materialInventoryLinkService';
import { MaterialLinkModal } from './MaterialLinkModal';
import { MATERIAL_CATEGORIES } from '@/modules/design-manager/types/materials';
import type { Material } from '@/modules/design-manager/types/materials';

interface LinkedMaterialsTabProps {
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string;
  userId: string;
}

export function LinkedMaterialsTab({
  inventoryItemId,
  inventoryItemName,
  inventoryItemSku,
  userId,
}: LinkedMaterialsTabProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const loadLinkedMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFullMaterialsLinkedToInventory(inventoryItemId);
      setMaterials(result);
    } catch (err) {
      setError('Failed to load linked materials');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [inventoryItemId]);

  useEffect(() => {
    loadLinkedMaterials();
  }, [loadLinkedMaterials]);

  const handleUnlink = async (material: Material) => {
    setUnlinkingId(material.id);
    try {
      await unlinkMaterialFromInventory(
        material.id,
        material.tier || 'global',
        undefined,
        inventoryItemId,
        userId
      );
      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
    } catch (err) {
      console.error('Failed to unlink material:', err);
      setError('Failed to unlink material');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleLink = async (material: Material) => {
    await linkMaterialToInventory(
      material.id,
      material.tier || 'global',
      undefined,
      inventoryItemId,
      inventoryItemSku,
      userId
    );
    // Refresh the list
    await loadLinkedMaterials();
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">
            Linked Materials
          </h3>
          {materials.length > 0 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {materials.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setLinkModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" />
          Link Material
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty state */}
      {materials.length === 0 && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Link2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-gray-700 mb-1">
            No materials linked
          </h4>
          <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">
            Link this inventory item to materials in the palette library to track
            design usage and material specifications.
          </p>
          <button
            onClick={() => setLinkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5"
          >
            <Plus className="w-4 h-4" />
            Link a Material
          </button>
        </div>
      )}

      {/* Linked materials list */}
      {materials.length > 0 && (
        <div className="space-y-2">
          {materials.map((mat) => {
            const catMeta = MATERIAL_CATEGORIES[mat.category] || {
              label: mat.category,
              icon: '📋',
            };
            const isUnlinking = unlinkingId === mat.id;
            const linkedDate = formatDate(mat.linkedAt);

            return (
              <div
                key={mat.id}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Name + code */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">
                        {mat.name}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        {mat.code}
                      </span>
                    </div>

                    {/* Category + tier badges */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                        {catMeta.icon} {catMeta.label}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded bg-indigo-50 text-indigo-600 capitalize">
                        {mat.tier}
                      </span>
                      {mat.qualityTier && (
                        <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-700 capitalize">
                          {mat.qualityTier}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {mat.description && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                        {mat.description}
                      </p>
                    )}

                    {/* Details row */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      {mat.dimensions?.thickness && (
                        <span>{mat.dimensions.thickness}mm thick</span>
                      )}
                      {mat.pricing?.unitCost != null && (
                        <span className="font-medium text-gray-700">
                          {mat.pricing.currency || 'UGX'}{' '}
                          {mat.pricing.unitCost.toLocaleString()}/{mat.pricing.unit || 'sheet'}
                        </span>
                      )}
                      {mat.grainPattern && mat.grainPattern !== 'none' && (
                        <span>Grain: {mat.grainPattern}</span>
                      )}
                      {linkedDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Linked {linkedDate}
                        </span>
                      )}
                    </div>

                    {/* Clip provenance */}
                    {mat.sourceUrl && (
                      <a
                        href={mat.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Source
                      </a>
                    )}
                  </div>

                  {/* Thumbnail (from clip) */}
                  {mat.sourceImageUrl && (
                    <img
                      src={mat.sourceImageUrl}
                      alt={mat.name}
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleUnlink(mat)}
                    disabled={isUnlinking}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    {isUnlinking ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Unlink className="w-3 h-3" />
                    )}
                    Unlink
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link Material Modal */}
      <MaterialLinkModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        inventoryItemName={inventoryItemName}
        inventoryItemSku={inventoryItemSku}
        excludeIds={materials.map((m) => m.id)}
        onLink={handleLink}
      />
    </div>
  );
}
