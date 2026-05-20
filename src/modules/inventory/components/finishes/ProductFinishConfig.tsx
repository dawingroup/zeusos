/**
 * ProductFinishConfig Component
 * Main configuration panel for finish & attribute settings on a product.
 * Rendered as a tab in InventoryItemDetail.
 */

import { useState, useCallback, useEffect } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import type { InventoryItem, FinishCategory, LinkedFinish } from '../../types';
import { FINISH_CATEGORIES, getSubtypesForCategory } from '../../types/finishLibrary';
import { updateInventoryItem } from '../../services/inventoryService';
import { FinishLinker } from './FinishLinker';
import { AttributeConfig } from './AttributeConfig';

interface ProductFinishConfigProps {
  item: InventoryItem;
  organizationId: string;
  userId: string;
  onUpdated: () => Promise<void>;
}

export function ProductFinishConfig({
  item,
  organizationId,
  userId,
  onUpdated,
}: ProductFinishConfigProps) {
  const [finishCategory, setFinishCategory] = useState<FinishCategory | undefined>(item.finishCategory);
  const [finishSubtype, setFinishSubtype] = useState<string | undefined>(item.finishSubtype);
  const [linkedFinishes, setLinkedFinishes] = useState<LinkedFinish[]>(item.linkedFinishes || []);
  const [requiredAttributes, setRequiredAttributes] = useState<string[]>(item.requiredAttributes || []);
  const [attributeConstraints, setAttributeConstraints] = useState<Record<string, (string | number | boolean)[]>>(
    item.attributeConstraints || {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Keep editor state aligned with the latest persisted item payload.
  // This ensures finish mappings rehydrate after a save/load cycle.
  useEffect(() => {
    setFinishCategory(item.finishCategory);
    setFinishSubtype(item.finishSubtype);
    setLinkedFinishes(item.linkedFinishes || []);
    setRequiredAttributes(item.requiredAttributes || []);
    setAttributeConstraints(item.attributeConstraints || {});
  }, [
    item.id,
    item.finishCategory,
    item.finishSubtype,
    item.linkedFinishes,
    item.requiredAttributes,
    item.attributeConstraints,
  ]);

  const subtypeOptions = finishCategory ? getSubtypesForCategory(finishCategory) : [];

  const hasChanges =
    finishCategory !== item.finishCategory ||
    finishSubtype !== item.finishSubtype ||
    JSON.stringify(linkedFinishes) !== JSON.stringify(item.linkedFinishes || []) ||
    JSON.stringify(requiredAttributes) !== JSON.stringify(item.requiredAttributes || []) ||
    JSON.stringify(attributeConstraints) !== JSON.stringify(item.attributeConstraints || {});

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const linkedFinishIds = linkedFinishes.map(lf => lf.finishId);

      await updateInventoryItem(item.id, {
        finishCategory,
        finishSubtype,
        linkedFinishes,
        linkedFinishIds,
        requiredAttributes,
        attributeConstraints,
      }, userId);

      await onUpdated();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [item.id, finishCategory, finishSubtype, linkedFinishes, requiredAttributes, attributeConstraints, userId, onUpdated]);

  return (
    <div className="space-y-6 p-4">
      {/* Category & Subtype */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Finish Category</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={finishCategory || ''}
              onChange={e => {
                const cat = e.target.value as FinishCategory || undefined;
                setFinishCategory(cat);
                setFinishSubtype(undefined);
                // Reset attributes when category changes
                setRequiredAttributes([]);
                setAttributeConstraints({});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not set</option>
              {FINISH_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {finishCategory && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subtype</label>
              {subtypeOptions.length > 0 ? (
                <select
                  value={finishSubtype || ''}
                  onChange={e => setFinishSubtype(e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any subtype</option>
                  {subtypeOptions.map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={finishSubtype || ''}
                  onChange={e => setFinishSubtype(e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter subtype"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Finish Linker */}
      {finishCategory && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Linked Finishes</h3>
          <FinishLinker
            organizationId={organizationId}
            category={finishCategory}
            subtype={finishSubtype}
            linkedFinishes={linkedFinishes}
            onChange={setLinkedFinishes}
          />
        </div>
      )}

      {/* Attribute Configuration */}
      {finishCategory && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Attribute Configuration</h3>
          <AttributeConfig
            organizationId={organizationId}
            category={finishCategory}
            requiredAttributes={requiredAttributes}
            attributeConstraints={attributeConstraints}
            onRequiredChange={setRequiredAttributes}
            onConstraintsChange={setAttributeConstraints}
          />
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Finish Config
        </button>

        {saved && (
          <span className="text-sm text-green-600">Saved</span>
        )}

        {error && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {error}
          </span>
        )}

        {!hasChanges && !saved && (
          <span className="text-xs text-gray-400">No unsaved changes</span>
        )}
      </div>
    </div>
  );
}
