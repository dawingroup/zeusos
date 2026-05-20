/**
 * ChangeOrderDesignItemPicker — in-wizard picker that either:
 *   (a) lets the user select an existing DesignItem from the SO's
 *       linked design project (with its latest unit cost), or
 *   (b) creates a brand-new DesignItem in place with minimal details
 *       (name, category, qty, unit price) and a seeded cost snapshot,
 *       so the CO can reference it immediately.
 *
 * On commit, calls back with `{ designItemId, description, specification,
 * quantity, unitPrice, category }`. The calling wizard pre-fills the
 * CO line-item row from those values; subsequent edits in DM will
 * re-price the item and the CO service auto-recalcs totals.
 */

import { useCallback, useEffect, useState } from 'react';
import { X, Search, Plus, Package, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  createDesignItem,
  getDesignItems,
} from '@/modules/design-manager/services/firestore';
import type { DesignItem, DesignCategory } from '@/modules/design-manager/types';
import { CATEGORY_LABELS } from '@/modules/design-manager/utils/formatting';
import type { ItemCategory } from '../types';

export interface ChangeOrderDesignItemPickerResult {
  designItemId: string;
  description: string;
  specification?: string;
  quantity: number;
  unitPrice: number;
  /** Best-fit SO category mapped from the DesignCategory. */
  category: ItemCategory;
  /** Whether this was a fresh DesignItem created by the picker. */
  wasCreated: boolean;
}

interface Props {
  designProjectId: string;
  currency: string;
  userId: string;
  onSelect: (result: ChangeOrderDesignItemPickerResult) => void;
  onClose: () => void;
  /** Pre-selected design item id (e.g. when editing an existing row). */
  initialDesignItemId?: string;
}

// ── Heuristic map: DesignCategory → SO ItemCategory ─────────────────────
function mapCategory(di: DesignCategory | undefined): ItemCategory {
  switch (di) {
    case 'casework':
    case 'millwork':
    case 'doors':
    case 'specialty':
      return 'fitout';
    case 'furniture':
      return 'furniture';
    case 'fixtures':
      return 'installation';
    case 'architectural':
      return 'fitout';
    default:
      return 'furniture';
  }
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function unitCost(di: DesignItem): number {
  return (
    di.manufacturingRollup?.costPerUnit ??
    di.manufacturing?.costPerUnit ??
    0
  );
}

const DESIGN_CATEGORIES: DesignCategory[] = [
  'casework',
  'furniture',
  'millwork',
  'doors',
  'fixtures',
  'specialty',
  'architectural',
];

export default function ChangeOrderDesignItemPicker({
  designProjectId,
  currency,
  userId,
  onSelect,
  onClose,
  initialDesignItemId,
}: Props) {
  const [mode, setMode] = useState<'pick' | 'create'>('pick');

  // ── Pick-existing state ──
  const [items, setItems] = useState<DesignItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialDesignItemId ?? null);
  const [quantity, setQuantity] = useState(1);
  const [overrideUnitPrice, setOverrideUnitPrice] = useState<string>('');

  // ── Create-new state ──
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<DesignCategory>('casework');
  const [newQty, setNewQty] = useState(1);
  const [newUnitPrice, setNewUnitPrice] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!designProjectId) {
      setListLoading(false);
      return;
    }
    (async () => {
      try {
        const fetched = await getDesignItems(designProjectId);
        setItems(fetched);
      } catch (err) {
        setListError((err as Error).message);
      } finally {
        setListLoading(false);
      }
    })();
  }, [designProjectId]);

  const filtered = items.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (i.itemCode ?? '').toLowerCase();
    return (
      (i.name ?? '').toLowerCase().includes(q) ||
      code.includes(q) ||
      (i.description ?? '').toLowerCase().includes(q)
    );
  });

  const selectedItem = items.find((i) => i.id === selectedId);
  const effectiveUnit = selectedItem
    ? overrideUnitPrice.trim() !== ''
      ? Number(overrideUnitPrice) || 0
      : unitCost(selectedItem)
    : 0;

  const handleConfirmPick = useCallback(() => {
    if (!selectedItem) return;
    onSelect({
      designItemId: selectedItem.id,
      description: selectedItem.name,
      specification: selectedItem.description,
      quantity,
      unitPrice: effectiveUnit,
      category: mapCategory(selectedItem.category),
      wasCreated: false,
    });
    onClose();
  }, [selectedItem, quantity, effectiveUnit, onSelect, onClose]);

  const handleConfirmCreate = useCallback(async () => {
    if (!newName.trim() || newQty <= 0 || newUnitPrice < 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const totalCost = newQty * newUnitPrice;
      const newId = await createDesignItem(
        designProjectId,
        {
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          category: newCategory,
          sourcingType: 'MANUFACTURED',
          // Seed initial cost snapshot so CO pricing picks up meaningful
          // numbers before the design item is fully estimated in DM.
          manufacturing: {
            sheetMaterials: [],
            sheetMaterialsCost: 0,
            timberMaterials: [],
            timberMaterialsCost: 0,
            linearMaterials: [],
            linearMaterialsCost: 0,
            edgingMaterials: [],
            edgingMaterialsCost: 0,
            standardParts: [],
            standardPartsCost: 0,
            specialParts: [],
            specialPartsCost: 0,
            processingSteps: [],
            processingCost: 0,
            materialCost: 0,
            laborHours: 0,
            laborRate: 0,
            laborCost: 0,
            totalCost,
            costPerUnit: newUnitPrice,
            quantity: newQty,
            autoCalculated: false,
            notes: 'Created from Change Order wizard; re-price in Design Manager to refine.',
          },
        },
        userId,
      );

      onSelect({
        designItemId: newId,
        description: newName.trim(),
        specification: newDescription.trim() || undefined,
        quantity: newQty,
        unitPrice: newUnitPrice,
        category: mapCategory(newCategory),
        wasCreated: true,
      });
      onClose();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [
    newName,
    newDescription,
    newCategory,
    newQty,
    newUnitPrice,
    designProjectId,
    userId,
    onSelect,
    onClose,
  ]);

  const canConfirmPick = Boolean(selectedItem) && quantity > 0 && effectiveUnit >= 0;
  const canConfirmCreate = newName.trim().length > 0 && newQty > 0 && newUnitPrice >= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Add design item to change order
            </h2>
            <p className="text-xs text-gray-500">
              Link an existing design item or create a new one — its price flows back to the CO.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Mode switch */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-5">
          {(['pick', 'create'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                mode === m
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'pick' ? 'Link existing' : 'Create new'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'pick' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, code, or description"
                  className="w-full pl-7 pr-3 py-1.5 rounded-md border border-gray-200 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {listLoading && (
                <div className="flex items-center justify-center py-6 text-xs text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading design items…
                </div>
              )}

              {listError && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{listError}</span>
                </div>
              )}

              {!listLoading && filtered.length === 0 && (
                <div className="text-center py-6">
                  <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">
                    {search
                      ? 'No design items match your search.'
                      : 'This project has no design items yet. Switch to "Create new" →'}
                  </p>
                </div>
              )}

              {!listLoading && filtered.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 max-h-72 overflow-y-auto">
                  {filtered.map((item) => {
                    const selected = item.id === selectedId;
                    const cost = unitCost(item);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-gray-50 ${
                            selected ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {selected ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                            ) : (
                              <div className="h-3.5 w-3.5 rounded-full border border-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-gray-500 font-mono ml-2">
                                {item.itemCode || '—'}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                              <span>{CATEGORY_LABELS[item.category] ?? item.category}</span>
                              <span>•</span>
                              <span>{item.currentStage}</span>
                              <span>•</span>
                              <span
                                className={
                                  cost > 0 ? 'text-emerald-700 font-medium' : 'text-gray-400'
                                }
                              >
                                {cost > 0
                                  ? `${formatCurrency(cost, currency)}/unit`
                                  : 'Unpriced'}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Quantity + price override for selected */}
              {selectedItem && (
                <div className="rounded-md border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-indigo-900">
                    Selected: {selectedItem.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                        Unit price ({currency})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={overrideUnitPrice}
                        onChange={(e) => setOverrideUnitPrice(e.target.value)}
                        placeholder={
                          unitCost(selectedItem) > 0
                            ? String(unitCost(selectedItem))
                            : 'Enter price'
                        }
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Leave blank to use design-item cost.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-indigo-900">
                    Line total:{' '}
                    <strong>{formatCurrency(quantity * effectiveUnit, currency)}</strong>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                  Item name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Base cabinet — 3 drawer, 600mm"
                  className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Specification details — materials, finish, dimensions…"
                  className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DESIGN_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCategory(c)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium capitalize border ${
                        newCategory === c
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {CATEGORY_LABELS[c] ?? c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-semibold block mb-0.5">
                    Unit price ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={newUnitPrice || ''}
                    onChange={(e) => setNewUnitPrice(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-md border border-indigo-200 bg-indigo-50/40 p-3 text-xs text-indigo-900">
                Line total:{' '}
                <strong>{formatCurrency(newQty * newUnitPrice, currency)}</strong>
                <p className="text-[11px] text-indigo-700 mt-1">
                  A new design item will be added to this project with a seeded cost of{' '}
                  {formatCurrency(newUnitPrice, currency)}/unit. Open it in Design Manager to
                  refine materials, labor, and final pricing — the CO will auto-recalc when the
                  design item is updated.
                </p>
              </div>

              {createError && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          {mode === 'pick' ? (
            <button
              type="button"
              onClick={handleConfirmPick}
              disabled={!canConfirmPick}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Use this item
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmCreate}
              disabled={!canConfirmCreate || creating}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? 'Creating…' : 'Create & use'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
