/**
 * BOQItemEditDrawer (MatFlow)
 *
 * Side drawer for editing a BOQ line item's core parameters:
 * description, specification, quantity, unit, and rates.
 */

import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import type { BOQItem } from '../../types';

interface BOQItemEditDrawerProps {
  item: BOQItem | null;
  onClose: () => void;
  onSave: (itemId: string, updates: Partial<BOQItem>) => Promise<void>;
}

export function BOQItemEditDrawer({ item, onClose, onSave }: BOQItemEditDrawerProps) {
  const [description, setDescription] = useState('');
  const [specification, setSpecification] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [laborRate, setLaborRate] = useState(0);
  const [equipmentRate, setEquipmentRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setDescription(item.description || '');
      setSpecification(item.specification || item.specifications || '');
      setUnit(item.unit || '');
      setQuantity(item.quantityContract ?? item.quantity ?? 0);
      setRate(item.rate ?? 0);
      setLaborRate(item.laborRate ?? 0);
      setEquipmentRate(item.equipmentRate ?? 0);
      setError(null);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);

    try {
      await onSave(item.id, {
        description,
        specification: specification || undefined,
        unit,
        quantity,
        quantityContract: quantity,
        rate,
        laborRate: laborRate || undefined,
        equipmentRate: equipmentRate || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Error updating BOQ item:', err);
      setError(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const amount = quantity * rate;
  const materialCost = (item?.materialRequirements ?? []).reduce(
    (sum: number, r: any) => sum + (r.totalCost ?? 0), 0
  );

  return (
    <Sheet open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit BOQ Item</SheetTitle>
          <SheetDescription>
            {item?.itemCode || item?.hierarchyPath} — {item?.billName || 'Line Item'}
          </SheetDescription>
        </SheetHeader>

        {item && (
          <div className="mt-6 space-y-5">
            {/* Hierarchy Context */}
            {(item.elementName || item.sectionName) && (
              <div className="text-xs text-gray-500 space-y-0.5 bg-gray-50 rounded-lg p-3">
                {item.billName && <div><span className="font-medium text-gray-700">Bill:</span> {item.billName}</div>}
                {item.elementName && <div><span className="font-medium text-gray-700">Element:</span> {item.elementName}</div>}
                {item.sectionName && <div><span className="font-medium text-gray-700">Section:</span> {item.sectionName}</div>}
                {item.hierarchyPath && <div><span className="font-medium text-gray-700">Path:</span> {item.hierarchyPath}</div>}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Specification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specification</label>
              <textarea
                value={specification}
                onChange={e => setSpecification(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Material specs, standards, grades..."
              />
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="m2, m3, nr, etc."
                />
              </div>
            </div>

            {/* Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (per {unit || 'unit'})</label>
              <input
                type="number"
                value={rate}
                onChange={e => setRate(parseFloat(e.target.value) || 0)}
                step="100"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Labour & Equipment Rates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Labour Rate</label>
                <input
                  type="number"
                  value={laborRate}
                  onChange={e => setLaborRate(parseFloat(e.target.value) || 0)}
                  step="100"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Rate</label>
                <input
                  type="number"
                  value={equipmentRate}
                  onChange={e => setEquipmentRate(parseFloat(e.target.value) || 0)}
                  step="100"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Computed Amounts */}
            <div className="bg-purple-50 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-medium text-purple-700 uppercase tracking-wider">Cost Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-600">BOQ Amount ({quantity} x {rate.toLocaleString()})</span>
                  <span className="font-medium text-purple-900">
                    UGX {amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {materialCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-purple-600">Material Cost</span>
                    <span className="font-medium text-purple-900">
                      UGX {materialCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {item.formulaCode && (
                  <div className="flex justify-between text-xs pt-1 border-t border-purple-200">
                    <span className="text-purple-500">Formula Applied</span>
                    <span className="text-purple-700">{item.formulaCode}</span>
                  </div>
                )}
              </div>
            </div>

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
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
