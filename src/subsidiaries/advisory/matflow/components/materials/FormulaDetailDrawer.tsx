/**
 * FormulaDetailDrawer
 *
 * Side drawer showing full formula/material breakdown for a BOQ line item.
 * Allows inline editing of material quantities, wastage, and unit prices,
 * then saves updates back to Firestore.
 */

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Beaker, Calculator, Trash2, Plus, Package } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import type { BOQItem } from '../../types';

interface MaterialRequirement {
  materialId?: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent?: number;
  wastageIncluded?: boolean;
  unitPrice?: number;
  unitRate?: number;
  totalCost?: number;
  specification?: string;
  source?: string;
}

interface FormulaDetailDrawerProps {
  item: BOQItem | null;
  onClose: () => void;
  onSave: (itemId: string, materials: MaterialRequirement[]) => Promise<void>;
}

export function FormulaDetailDrawer({ item, onClose, onSave }: FormulaDetailDrawerProps) {
  const [materials, setMaterials] = useState<MaterialRequirement[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from item
  useEffect(() => {
    if (item?.materialRequirements) {
      setMaterials(
        item.materialRequirements.map((r: any) => ({
          materialId: r.materialId || '',
          materialName: r.materialName || r.materialId || '',
          quantity: r.quantity ?? 0,
          unit: r.unit || 'nr',
          wastagePercent: r.wastagePercent ?? 0,
          wastageIncluded: r.wastageIncluded ?? false,
          unitPrice: r.unitPrice ?? r.unitRate ?? 0,
          totalCost: r.totalCost ?? 0,
          specification: r.specification || '',
          source: r.source || '',
        }))
      );
      setHasChanges(false);
      setError(null);
    } else {
      setMaterials([]);
    }
  }, [item]);

  const boqQty = item ? (item.quantityContract ?? item.quantity ?? 0) : 0;

  // Computed totals
  const totals = useMemo(() => {
    const materialCost = materials.reduce((sum, m) => sum + (m.totalCost ?? 0), 0);
    const laborCost = boqQty * (item?.laborRate ?? 0);
    const equipmentCost = boqQty * (item?.equipmentRate ?? 0);
    return { materialCost, laborCost, equipmentCost, total: materialCost + laborCost + equipmentCost };
  }, [materials, boqQty, item]);

  const updateMaterial = (index: number, field: keyof MaterialRequirement, value: any) => {
    setMaterials(prev => {
      const updated = [...prev];
      const m = { ...updated[index], [field]: value };

      // Recalculate totalCost when quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        m.totalCost = (m.quantity ?? 0) * (m.unitPrice ?? 0);
      }

      updated[index] = m;
      return updated;
    });
    setHasChanges(true);
  };

  const removeMaterial = (index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addMaterial = () => {
    setMaterials(prev => [
      ...prev,
      {
        materialId: '',
        materialName: '',
        quantity: 0,
        unit: 'nr',
        wastagePercent: 5,
        wastageIncluded: false,
        unitPrice: 0,
        totalCost: 0,
        specification: '',
        source: 'manual',
      },
    ]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);

    try {
      await onSave(item.id, materials);
      setHasChanges(false);
      onClose();
    } catch (err: any) {
      console.error('Error saving materials:', err);
      setError(err.message || 'Failed to save materials');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(n);

  return (
    <Sheet open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {item?.formulaId ? (
              <><Beaker className="w-5 h-5 text-green-600" /> Formula Details</>
            ) : item?.isBulkItem ? (
              <><Package className="w-5 h-5 text-blue-600" /> Bulk Item</>
            ) : (
              <><Calculator className="w-5 h-5 text-purple-600" /> Material Breakdown</>
            )}
          </SheetTitle>
          <SheetDescription>
            {item?.itemCode || item?.hierarchyPath} — {item?.description}
          </SheetDescription>
        </SheetHeader>

        {item && (
          <div className="mt-6 space-y-5">
            {/* Item Context */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs text-gray-600">
              {item.billName && <div><span className="font-medium text-gray-700">Bill:</span> {item.billName}</div>}
              {item.elementName && <div><span className="font-medium text-gray-700">Element:</span> {item.elementName}</div>}
              {item.sectionName && <div><span className="font-medium text-gray-700">Section:</span> {item.sectionName}</div>}
              {item.specification && <div><span className="font-medium text-gray-700">Specification:</span> {item.specification}</div>}
              <div className="flex gap-6 pt-1">
                <span><span className="font-medium text-gray-700">Quantity:</span> {boqQty.toLocaleString()} {item.unit}</span>
                {item.formulaCode && <span><span className="font-medium text-gray-700">Formula:</span> {item.formulaCode}</span>}
                {item.formulaName && <span><span className="font-medium text-gray-700">Name:</span> {item.formulaName}</span>}
              </div>
            </div>

            {/* Material Requirements */}
            {materials.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    Materials ({materials.length})
                  </h4>
                  <button
                    onClick={addMaterial}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Material
                  </button>
                </div>

                <div className="space-y-3">
                  {materials.map((m, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                      {/* Material Name */}
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={m.materialName}
                          onChange={e => updateMaterial(idx, 'materialName', e.target.value)}
                          className="text-sm font-medium text-gray-900 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-0 py-0.5 w-full bg-transparent"
                          placeholder="Material name"
                        />
                        <button
                          onClick={() => removeMaterial(idx)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded ml-2 flex-shrink-0"
                          title="Remove material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Specification */}
                      {(m.specification || hasChanges) && (
                        <input
                          type="text"
                          value={m.specification || ''}
                          onChange={e => updateMaterial(idx, 'specification', e.target.value)}
                          className="text-xs text-gray-500 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-0 py-0.5 w-full bg-transparent italic"
                          placeholder="Specification / grade"
                        />
                      )}

                      {/* Editable Fields Grid */}
                      <div className="grid grid-cols-5 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Quantity</label>
                          <input
                            type="number"
                            value={m.quantity}
                            onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            step="0.01"
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Unit</label>
                          <input
                            type="text"
                            value={m.unit}
                            onChange={e => updateMaterial(idx, 'unit', e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Wastage %</label>
                          <input
                            type="number"
                            value={m.wastagePercent ?? 0}
                            onChange={e => updateMaterial(idx, 'wastagePercent', parseFloat(e.target.value) || 0)}
                            step="0.5"
                            min="0"
                            max="50"
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Unit Price</label>
                          <input
                            type="number"
                            value={m.unitPrice ?? 0}
                            onChange={e => updateMaterial(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            step="100"
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Total Cost</label>
                          <div className="text-xs font-medium text-gray-900 px-2 py-1.5 bg-gray-50 rounded border border-gray-100">
                            {fmt(m.totalCost ?? 0)}
                          </div>
                        </div>
                      </div>

                      {/* Source badge */}
                      {m.source && (
                        <div className="text-xs text-gray-400">
                          Source: <span className="text-gray-500">{m.source}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Calculator className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No material requirements</p>
                <button
                  onClick={addMaterial}
                  className="mt-3 text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 mx-auto"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Material
                </button>
              </div>
            )}

            {/* Cost Summary */}
            {materials.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <h4 className="text-xs font-medium text-blue-700 uppercase tracking-wider">Cost Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Material Cost</span>
                    <span className="font-medium text-blue-900">UGX {fmt(totals.materialCost)}</span>
                  </div>
                  {totals.laborCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">Labour Cost</span>
                      <span className="font-medium text-blue-900">UGX {fmt(totals.laborCost)}</span>
                    </div>
                  )}
                  {totals.equipmentCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">Equipment Cost</span>
                      <span className="font-medium text-blue-900">UGX {fmt(totals.equipmentCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-blue-200">
                    <span className="font-medium text-blue-800">Line Total</span>
                    <span className="font-bold text-blue-900">UGX {fmt(totals.total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {hasChanges ? 'Discard' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
