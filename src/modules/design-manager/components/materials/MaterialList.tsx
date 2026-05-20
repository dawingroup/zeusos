/**
 * MaterialList Component
 * Display and manage materials at any tier with inventory integration
 */

import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Filter, Link2, Link2Off, Boxes, AlertTriangle, ShoppingCart } from 'lucide-react';
import { useMaterials, useMaterialMutations } from '../../hooks/useMaterials';
import { useMaterialsWithInventory, useMaterialInventoryLink } from '@/modules/inventory/hooks/useMaterialInventoryLink';
import { MaterialForm } from './MaterialForm';
import { MaterialDetailDrawer } from './MaterialDetailDrawer';
import { InventoryLinkModal } from './InventoryLinkModal';
import { MATERIAL_CATEGORIES } from '../../types/materials';
import type { MaterialTier, MaterialCategory, MaterialFormData, Material, MaterialWithInventory } from '../../types/materials';
import { resolveMaterialUnitCost } from '../../types/materialCost';
import { detectMaterialCostDrift } from '../../services/materialCostService';
import { getMaterial } from '../../services/materialService';

interface MaterialListProps {
  tier: MaterialTier;
  scopeId?: string;
  userId: string;
  title?: string;
}

export function MaterialList({ tier, scopeId, userId, title }: MaterialListProps) {
  const { materials, loading, error } = useMaterials({ tier, scopeId });
  const { createMaterial, updateMaterial, deleteMaterial, creating, updating, deleting } = useMaterialMutations(tier, scopeId, userId);

  // Inventory integration
  const { resolved: materialsWithInventory } = useMaterialsWithInventory(materials as Material[]);
  const { link, unlink, linking, unlinking } = useMaterialInventoryLink(userId);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all');
  const [showLinkedOnly, setShowLinkedOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [linkingMaterial, setLinkingMaterial] = useState<Material | null>(null);
  const [procureRequestMaterial, setProcureRequestMaterial] = useState<Material | null>(null);
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);

  // Merge inventory data with materials - create a map for quick lookup
  const inventoryMap = new Map(materialsWithInventory.map((m) => [m.id, m]));

  // Use materials list with inventory data merged in
  type DisplayMaterial = typeof materials[number] & Partial<MaterialWithInventory>;
  const displayMaterials: DisplayMaterial[] = materials.map((m) => {
    const withInventory = inventoryMap.get(m.id);
    return {
      ...m,
      inventory: withInventory?.inventory,
      suppliers: withInventory?.suppliers,
      inventoryItemId: withInventory?.inventoryItemId,
      inventoryItemSku: withInventory?.inventoryItemSku,
    };
  });

  const filteredMaterials = displayMaterials.filter((m) => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    const matchesLinked = !showLinkedOnly || !!(m as DisplayMaterial).inventoryItemId;
    return matchesSearch && matchesCategory && matchesLinked;
  });

  const handleCreate = async (data: MaterialFormData) => {
    await createMaterial(data);
    setShowForm(false);
  };

  const handleEdit = async (materialId: string) => {
    try {
      const material = await getMaterial(materialId, tier, scopeId);
      if (material) {
        setEditingMaterial(material);
      }
    } catch (err) {
      console.error('Failed to load material for editing:', err);
    }
  };

  const handleUpdate = async (data: MaterialFormData) => {
    if (!editingMaterial) return;
    await updateMaterial(editingMaterial.id, data);
    setEditingMaterial(null);
  };

  const handleDelete = async (materialId: string) => {
    await deleteMaterial(materialId);
    setDeleteConfirm(null);
  };

  const handleLinkToInventory = async (inventoryItemId: string, inventoryItemSku: string) => {
    if (!linkingMaterial) return;
    await link(linkingMaterial.id, tier, scopeId, inventoryItemId, inventoryItemSku);
    setLinkingMaterial(null);
  };

  const handleUnlinkFromInventory = async (material: DisplayMaterial) => {
    if (!material.inventoryItemId) return;
    if (!confirm(`Unlink "${material.name}" from inventory item ${material.inventoryItemSku}?`)) return;
    await unlink(material.id, tier, scopeId, material.inventoryItemId);
  };

  const getStockStatus = (inStock: number | undefined) => {
    if (inStock === undefined) return null;
    if (inStock <= 0) return { label: 'Out', color: 'text-red-600 bg-red-50', icon: AlertTriangle };
    if (inStock < 10) return { label: 'Low', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle };
    return { label: `${inStock}`, color: 'text-green-600 bg-green-50', icon: Boxes };
  };

  const tierLabel = tier === 'global' ? 'Global' : tier === 'customer' ? 'Customer' : 'Project';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {title || `${tierLabel} Materials`}
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Material
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as MaterialCategory | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Categories</option>
            {Object.entries(MATERIAL_CATEGORIES).map(([key, { label, icon }]) => (
              <option key={key} value={key}>{icon} {label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showLinkedOnly}
            onChange={(e) => setShowLinkedOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Link2 className="h-4 w-4" />
          Linked Only
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error.message}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading materials...</div>
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No materials found</h3>
          <p className="text-gray-500 mt-1">
            {search || categoryFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Add your first material to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thickness</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Inventory</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMaterials.map((material) => {
                const matWithInv = material as DisplayMaterial;
                const stockStatus = matWithInv.inventory ? getStockStatus(matWithInv.inventory.inStock) : null;
                const hasInventoryLink = !!matWithInv.inventoryItemId;

                // P12-4 (F11) — canonical cost + drift detection.
                // `resolveMaterialUnitCost` picks the authoritative value
                // (override > inventory > material-pricing > null). The
                // drift detector is pure and surfaces only when drift is
                // meaningful (no link / override on → returns null).
                const resolvedPricingShape = {
                  inventoryItemId: matWithInv.inventoryItemId,
                  pricing:
                    typeof material.unitCost === 'number' && material.currency
                      ? {
                          unitCost: material.unitCost,
                          currency: material.currency,
                          isOverride: material.isOverride,
                        }
                      : undefined,
                };
                const inventoryCostShape =
                  matWithInv.inventory?.costPerUnit && matWithInv.inventory?.currency
                    ? {
                        costPerUnit: matWithInv.inventory.costPerUnit,
                        currency: matWithInv.inventory.currency,
                      }
                    : null;
                const resolvedCost = resolveMaterialUnitCost(
                  resolvedPricingShape,
                  inventoryCostShape,
                );
                const drift = detectMaterialCostDrift(
                  // The drift detector expects a full Material shape but
                  // only reads inventoryItemId + pricing — the list item
                  // carries enough to satisfy it structurally.
                  resolvedPricingShape as unknown as Material,
                  inventoryCostShape,
                );

                return (
                  <tr
                    key={material.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      getMaterial(material.id, tier, scopeId).then((m) => {
                        if (m) setDetailMaterial(m);
                      });
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{material.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{material.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        {MATERIAL_CATEGORIES[material.category]?.icon}
                        {MATERIAL_CATEGORIES[material.category]?.label}
                      </span>
                      {material.subcategory && (
                        <span className="block text-xs text-gray-400 mt-0.5">{material.subcategory}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {material.thickness ? `${material.thickness}mm` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {resolvedCost ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span>
                            {resolvedCost.currency} {resolvedCost.unitCost.toLocaleString()}
                          </span>
                          {resolvedCost.source === 'override' && (
                            <span
                              className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium"
                              title={
                                resolvedCost.overrideReason
                                  ? `Override: ${resolvedCost.overrideReason}`
                                  : 'Custom cost pinned (overrides linked inventory)'
                              }
                            >
                              Override
                            </span>
                          )}
                          {drift?.hasDrift && (
                            <span
                              className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium"
                              title={
                                drift.currencyMismatch
                                  ? `Currency mismatch — Material: ${drift.materialCurrency} ${drift.materialUnitCost}, Inventory: ${drift.inventoryCurrency} ${drift.inventoryUnitCost}`
                                  : `Drift ${drift.delta?.toLocaleString()} — Material: ${drift.materialUnitCost}, Inventory: ${drift.inventoryUnitCost}. Toggle "Override" on the material to accept, or refresh pricing.`
                              }
                            >
                              Drift
                            </span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasInventoryLink ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500 font-mono">{matWithInv.inventoryItemSku}</span>
                          {stockStatus && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${stockStatus.color}`}>
                              <stockStatus.icon className="h-3 w-3" />
                              {stockStatus.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not linked</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        material.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : material.status === 'discontinued'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {material.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {hasInventoryLink ? (
                          <button
                            onClick={() => handleUnlinkFromInventory(matWithInv)}
                            disabled={unlinking}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Unlink from Inventory"
                          >
                            <Link2Off className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setLinkingMaterial(matWithInv as Material)}
                            disabled={linking}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"
                            title="Link to Inventory"
                          >
                            <Link2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            getMaterial(material.id, tier, scopeId).then((m) => {
                              if (m) setProcureRequestMaterial(m);
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="Request Procurement"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(material.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {deleteConfirm === material.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(material.id)}
                              disabled={deleting}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(material.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Material Dialog */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Add {tierLabel} Material</h3>
            </div>
            <div className="p-4">
              <MaterialForm
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
                isSubmitting={creating}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Material Dialog */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Edit Material</h3>
            </div>
            <div className="p-4">
              <MaterialForm
                material={editingMaterial}
                onSubmit={handleUpdate}
                onCancel={() => setEditingMaterial(null)}
                isSubmitting={updating}
              />
            </div>
          </div>
        </div>
      )}

      {/* Link to Inventory Dialog */}
      {linkingMaterial && (
        <InventoryLinkModal
          isOpen={!!linkingMaterial}
          onClose={() => setLinkingMaterial(null)}
          material={linkingMaterial}
          onLink={handleLinkToInventory}
        />
      )}

      {/* Request Procurement Dialog */}
      {procureRequestMaterial && (
        <RequestProcurementDialog
          material={procureRequestMaterial}
          userId={userId}
          onClose={() => setProcureRequestMaterial(null)}
        />
      )}

      {/* Material Detail Drawer */}
      <MaterialDetailDrawer
        material={detailMaterial}
        open={!!detailMaterial}
        onClose={() => setDetailMaterial(null)}
      />
    </div>
  );
}

// ============================================
// Inline Request Procurement Dialog
// ============================================

import { createProcurementRequest } from '@/modules/procurement/services/procurementRequestService';
import type { ProcurementUrgency } from '@/modules/procurement/types/procurementRequest';

function RequestProcurementDialog({
  material,
  userId,
  onClose,
}: {
  material: Material;
  userId: string;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const [unit, _setUnit] = useState(material.pricing?.unit || 'ea');
  const [urgency, setUrgency] = useState<ProcurementUrgency>('normal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createProcurementRequest(
        { materialId: material.id, quantity: qty, unit, urgency, notes: notes || undefined },
        material,
        userId,
        userId, // userName — email as fallback
        'finishes',
      );
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Request Procurement</h3>
          <p className="text-sm text-gray-500 mt-0.5">{material.name} ({material.code})</p>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success ? (
            <div className="text-center py-6">
              <div className="text-green-600 font-medium">Request submitted</div>
              <p className="text-sm text-gray-500 mt-1">The procurement team will review it shortly.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as ProcurementUrgency)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </>
          )}
        </div>
        {!success && (
          <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MaterialList;
