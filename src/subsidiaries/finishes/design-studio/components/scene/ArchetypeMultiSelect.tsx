/**
 * ArchetypeMultiSelect — multi-pick dropdown for cabinet archetypes,
 * grouped by FurnitureDomain.
 *
 * Renders a button showing the current selection (count + first label)
 * and a popover that lists every archetype in `ARCHETYPE_LIBRARY`,
 * grouped under domain headers, with a search box. Checking multiple
 * items builds a union — the AI grouper merges their expectedAssemblies
 * + coverPanelHints into one context block.
 *
 * Writes via `setCabinetArchetypes`, which rejects locked cabinets at
 * the service layer and mirrors the primary selection onto the legacy
 * `archetypeId` field so old readers keep working.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import {
  ARCHETYPE_LIBRARY,
  FURNITURE_DOMAINS,
  type ArchetypeDefinition,
  type FurnitureDomain,
} from '../../constants/furnitureDomains';
import { setCabinetArchetypes } from '../../services/scene.service';

interface Props {
  sceneId: string;
  cabinetId: string;
  /** Current selection (merged from archetypeIds + legacy archetypeId). */
  value: string[];
  disabled?: boolean;
  /** Fires after a successful write so the parent can refetch. */
  onChanged?: (ids: string[]) => void;
}

const DOMAIN_LABEL: Record<FurnitureDomain, string> = {
  kitchen: 'Kitchen',
  wardrobe: 'Wardrobe',
  workspace: 'Workspace',
  reception: 'Reception',
  retail: 'Retail',
  pharmacy: 'Pharmacy',
  storage: 'Storage',
  library: 'Library',
  display: 'Display',
};

export function ArchetypeMultiSelect({
  sceneId, cabinetId, value, disabled, onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<string[]>(value);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep local mirror in sync with external changes.
  useEffect(() => { setLocal(value); }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Group archetypes by domain, applying the search filter.
  const grouped = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out: Array<{ domain: FurnitureDomain; entries: Array<{ id: string } & ArchetypeDefinition> }> = [];
    for (const domain of FURNITURE_DOMAINS) {
      const entries = Object.entries(ARCHETYPE_LIBRARY)
        .filter(([, def]) => def.domain === domain)
        .filter(([id, def]) =>
          !query
          || id.toLowerCase().includes(query)
          || def.label.toLowerCase().includes(query)
          || def.description.toLowerCase().includes(query)
        )
        .map(([id, def]) => ({ id, ...def }));
      if (entries.length) out.push({ domain, entries });
    }
    return out;
  }, [q]);

  const toggle = (id: string) => {
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const commit = async (next: string[]) => {
    setSaving(true); setErr(null);
    try {
      await setCabinetArchetypes(sceneId, cabinetId, next);
      onChanged?.(next);
    } catch (e) {
      setErr((e as Error).message || 'Failed to save');
      setLocal(value); // revert
    } finally {
      setSaving(false);
    }
  };

  const applyAndClose = () => {
    setOpen(false);
    // Only persist when the selection actually changed.
    const sameLen = local.length === value.length;
    const sameSet = sameLen && local.every(id => value.includes(id));
    if (!sameSet) void commit(local);
  };

  const summary = (() => {
    if (value.length === 0) return 'Select archetypes…';
    const primary = ARCHETYPE_LIBRARY[value[0]];
    if (value.length === 1) return primary?.label ?? value[0];
    return `${primary?.label ?? value[0]} + ${value.length - 1}`;
  })();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        title={disabled ? 'Locked cabinet — unlock to change archetypes' : 'Pick one or more archetypes'}
        className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="truncate max-w-[180px]">{summary}</span>
        {saving
          ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {err && <p className="absolute left-0 mt-1 text-[10px] text-red-600">{err}</p>}

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 rounded-lg border border-border bg-background shadow-xl max-h-[60vh] flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search archetype…"
                className="w-full pl-6 pr-2 py-1 text-xs rounded border border-border bg-background"
                autoFocus
              />
            </div>
            {local.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {local.map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]"
                  >
                    {ARCHETYPE_LIBRARY[id]?.label ?? id}
                    <X className="h-2.5 w-2.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <ul className="flex-1 overflow-auto p-1">
            {grouped.length === 0 && (
              <li className="text-xs text-muted-foreground italic p-2">No matches</li>
            )}
            {grouped.map(g => (
              <li key={g.domain}>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5">
                  {DOMAIN_LABEL[g.domain]}
                </p>
                <ul>
                  {g.entries.map(a => {
                    const checked = local.includes(a.id);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => toggle(a.id)}
                          className={`w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-start gap-2 ${checked ? 'bg-blue-50' : ''}`}
                        >
                          <span className={`mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-border'}`}>
                            {checked && <Check className="h-2.5 w-2.5" />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{a.label}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-2">{a.description}</p>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>

          <div className="p-2 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {local.length} selected
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => { setLocal(value); setOpen(false); }}
                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyAndClose}
                disabled={saving}
                className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
