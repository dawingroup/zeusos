/**
 * DesignProjectPicker — Choose an existing DesignProject to attach a scene
 * (or workshop session) to.
 *
 * P21.1 (Slice: force scenes project-backed on creation): the Scene
 * Composer "New Scene" dialog and the Workshop Viewer "Bind session"
 * card both need a searchable list of real DesignProjects. Without one
 * selected, the caller should keep its primary action disabled — no more
 * silent `projectId: 'standalone'` fallback.
 *
 * Shape mirrors {@link DesignItemPicker} deliberately so the two pickers
 * compose in a single flow (pick project → pick item) without surprising
 * users with a different look-and-feel mid-dialog.
 *
 * Create-new is intentionally NOT provided here. Spinning up a new
 * DesignProject is a bigger commitment than creating a DesignItem — it
 * needs a customer, code, etc. — and Design Manager already has that
 * form. If callers need it, they can route the user to the Design
 * Manager project-create flow and come back.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { getProjects } from '@/modules/design-manager/services';
import type { DesignProject } from '@/modules/design-manager/types';

export interface DesignProjectPickerValue {
  id: string;
  name: string;
  code?: string;
  customerId?: string;
  customerName?: string;
}

interface DesignProjectPickerProps {
  value: DesignProjectPickerValue | null;
  onChange: (value: DesignProjectPickerValue | null) => void;
  disabled?: boolean;
  /** Optional: only show projects with one of these statuses. Defaults
   *  to `['active']` because attaching a scene to a cancelled or completed
   *  project is almost always a mistake. Callers that need the wider
   *  set (e.g. an admin rebinding a legacy scene) can pass `undefined`. */
  statuses?: Array<'active' | 'on-hold' | 'completed' | 'cancelled'> | null;
}

export function DesignProjectPicker({
  value,
  onChange,
  disabled,
  statuses = ['active'],
}: DesignProjectPickerProps) {
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjects()
      .then(list => {
        if (!cancelled) setProjects(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Failed to load projects');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const statusFiltered = statuses
      ? projects.filter(p => statuses.includes(p.status))
      : projects;
    if (!search.trim()) return statusFiltered;
    const q = search.toLowerCase();
    return statusFiltered.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q),
    );
  }, [projects, search, statuses]);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{value.name}</div>
              {(value.code || value.customerName) && (
                <div className="text-[10px] text-blue-800/80 truncate">
                  {[value.code, value.customerName].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
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
            placeholder="Search design projects..."
            disabled={disabled || loading}
            className="w-full border rounded-md pl-8 pr-3 py-2 text-sm disabled:bg-gray-50"
          />
        </div>
      )}

      {loading && !value && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading projects…
        </p>
      )}
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}

      {!value && !loading && (
        <div className="rounded-md border border-gray-200 divide-y max-h-56 overflow-y-auto">
          {filtered.length === 0 && !search && (
            <p className="text-xs text-gray-500 text-center py-3">
              No active projects found. Create one in Design Manager first.
            </p>
          )}
          {filtered.length === 0 && search && (
            <p className="text-xs text-gray-500 text-center py-3">
              No matches for "{search}".
            </p>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onChange({
                  id: p.id,
                  name: p.name,
                  code: p.code,
                  customerId: p.customerId,
                  customerName: p.customerName,
                })
              }
              disabled={disabled}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{p.name}</span>
                {p.code && (
                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                    {p.code}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                {p.customerName && <span className="truncate">{p.customerName}</span>}
                <span className="px-1.5 py-0.5 rounded bg-gray-100">{p.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DesignProjectPicker;
