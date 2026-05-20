/**
 * DesignItemPicker — Choose (or create) a DesignItem to link a cabinet to
 *
 * P2 (Slice 3): every cabinet-create entry point renders this picker so the
 * resulting `SceneCabinet` carries a `designItemId`. Without an item
 * selected, the calling dialog should keep its primary action disabled.
 *
 * UX shape:
 *   - Loads all DesignItems under the given `projectId` on mount.
 *   - Shows a searchable list; selecting an item calls `onChange(item)`.
 *   - A "+ Create new DesignItem…" row opens an inline form (name +
 *     category + sourcing type defaulted to MANUFACTURED) that creates
 *     the item via `createDesignItem` and auto-selects it.
 *   - If `projectId` is empty or the Quick Review "standalone" sentinel,
 *     renders a disabled state explaining that the scene needs a real
 *     project first (migration / operator handoff covered in Slice 5).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Check, Loader2 } from 'lucide-react';
import {
  createDesignItem,
  getDesignItems,
} from '@/modules/design-manager/services';
import type { DesignItem, DesignCategory } from '@/modules/design-manager/types';
import { isStandaloneProjectId } from '../../utils/sceneProjectUtils';

export interface DesignItemPickerValue {
  id: string;
  name: string;
}

interface DesignItemPickerProps {
  projectId: string;
  userId: string;
  value: DesignItemPickerValue | null;
  onChange: (value: DesignItemPickerValue | null) => void;
  /** Optional: disables the picker UI entirely. */
  disabled?: boolean;
  /** Optional: default category when creating a new item inline. */
  defaultCategory?: DesignCategory;
}

const CATEGORY_OPTIONS: DesignCategory[] = [
  'casework',
  'furniture',
  'millwork',
  'doors',
  'fixtures',
  'specialty',
  'architectural',
];

export function DesignItemPicker({
  projectId,
  userId,
  value,
  onChange,
  disabled,
  defaultCategory = 'casework',
}: DesignItemPickerProps) {
  const [items, setItems] = useState<DesignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<DesignCategory>(defaultCategory);
  const [creating, setCreating] = useState(false);

  const isStandalone = isStandaloneProjectId(projectId);

  // Load DesignItems for the project. Refreshes when projectId changes.
  useEffect(() => {
    if (isStandalone) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDesignItems(projectId)
      .then(list => {
        if (!cancelled) setItems(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Failed to load design items');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, isStandalone]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      item =>
        item.name?.toLowerCase().includes(q) ||
        item.itemCode?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !projectId || isStandalone) return;
    setCreating(true);
    setError(null);
    try {
      const newId = await createDesignItem(
        projectId,
        {
          name: newName.trim(),
          category: newCategory,
          sourcingType: 'MANUFACTURED',
        },
        userId,
      );
      // Re-fetch so the list includes the new item, then auto-select.
      const list = await getDesignItems(projectId);
      setItems(list);
      onChange({ id: newId, name: newName.trim() });
      setShowCreateForm(false);
      setNewName('');
      setNewCategory(defaultCategory);
    } catch (err) {
      setError((err as Error).message || 'Failed to create design item');
    } finally {
      setCreating(false);
    }
  }, [newName, newCategory, projectId, isStandalone, userId, onChange, defaultCategory]);

  if (isStandalone) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-medium">Standalone scene — no project linked</p>
        <p className="mt-1 text-amber-700">
          This scene isn't attached to a real project yet, so cabinets here
          can't be linked to a DesignItem. Attach the scene to a project
          before handoff to production.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected chip or search field */}
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{value.name}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-blue-700 hover:underline flex-shrink-0 ml-2"
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search design items..."
            disabled={disabled || loading}
            className="w-full border rounded-md pl-8 pr-3 py-2 text-sm disabled:bg-gray-50"
          />
        </div>
      )}

      {/* Loading / error */}
      {loading && !value && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading design items…
        </p>
      )}
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}

      {/* Results list */}
      {!value && !loading && (
        <div className="rounded-md border border-gray-200 divide-y max-h-48 overflow-y-auto">
          {filtered.length === 0 && !search && (
            <p className="text-xs text-gray-500 text-center py-3">
              No design items yet — create the first one below.
            </p>
          )}
          {filtered.length === 0 && search && (
            <p className="text-xs text-gray-500 text-center py-3">
              No matches for "{search}".
            </p>
          )}
          {filtered.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ id: item.id, name: item.name })}
              disabled={disabled}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{item.name}</span>
                {item.itemCode && (
                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                    {item.itemCode}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                <span className="px-1.5 py-0.5 rounded bg-gray-100">{item.category}</span>
                {item.sourcingType && <span>{item.sourcingType}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Inline create form */}
      {!value && showCreateForm && (
        <div className="rounded-md border border-dashed border-blue-300 bg-blue-50/50 p-3 space-y-2">
          <p className="text-xs font-medium text-blue-900">Create a new design item</p>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Kitchen"
            disabled={disabled || creating}
            autoFocus
            className="w-full border rounded-md px-2 py-1.5 text-sm"
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value as DesignCategory)}
            disabled={disabled || creating}
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
          >
            {CATEGORY_OPTIONS.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewName('');
              }}
              disabled={creating}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {creating && <Loader2 className="h-3 w-3 animate-spin" />}
              Create & select
            </button>
          </div>
        </div>
      )}

      {!value && !showCreateForm && !loading && (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          disabled={disabled}
          className="w-full border border-dashed border-gray-300 rounded-md px-3 py-2 text-xs text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Create new DesignItem…
        </button>
      )}
    </div>
  );
}

export default DesignItemPicker;
