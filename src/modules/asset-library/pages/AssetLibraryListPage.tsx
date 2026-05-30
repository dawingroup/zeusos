/**
 * /assets — searchable grid of all assets with category / status filters.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAssets } from '../services/asset-item.service';
import type {
  AssetItem,
  AssetCategory,
  AssetStatus,
} from '../types/asset-item.types';
import { AssetGrid } from '../components/AssetGrid';
import { AssetSearchBar } from '../components/AssetSearchBar';
import { PageHero } from '@/shared/components/refresh';

const CATEGORY_OPTIONS: Array<AssetCategory | 'ALL'> = [
  'ALL',
  'LOGO',
  'GUIDELINE',
  'PHOTO',
  'VIDEO',
  'FONT',
  'COLOR_PALETTE',
  'TEMPLATE',
  'OTHER',
];

const STATUS_OPTIONS: Array<AssetStatus | 'ALL'> = [
  'ALL',
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
];

export default function AssetLibraryListPage() {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'ALL'>('ACTIVE');
  const [clientFilter, setClientFilter] = useState('');
  const [subsidiaryFilter, setSubsidiaryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAssets({
      category:        categoryFilter === 'ALL' ? undefined : categoryFilter,
      status:          statusFilter   === 'ALL' ? undefined : statusFilter,
      clientId:        clientFilter || undefined,
      subsidiaryOrgId: subsidiaryFilter || undefined,
      // Only one array-contains is allowed per Firestore query, so we
      // pass the first active tag as a server-side filter and treat the
      // rest as client-side narrowing below.
      tag:             activeTags[0],
    })
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((err) => { if (!cancelled) setError(String((err as Error).message)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [categoryFilter, statusFilter, clientFilter, subsidiaryFilter, activeTags]);

  const filtered = useMemo(() => {
    let rows = items;

    // Narrow further by the 2nd+ active tags.
    if (activeTags.length > 1) {
      const rest = activeTags.slice(1);
      rows = rows.filter((it) => rest.every((t) => it.tags.includes(t)));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [items, search, activeTags]);

  function handleTagClick(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev : [...prev, tag],
    );
  }

  function handleRemoveTag(tag: string) {
    setActiveTags((prev) => prev.filter((t) => t !== tag));
  }

  // Surface the most popular tags from the loaded items so users can
  // narrow without typing. Cheap client-side computation.
  const tagSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t)
      .filter((t) => !activeTags.includes(t));
  }, [items, activeTags]);

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Operations · Asset Library"
        title="Asset library"
        body="Logos, brand guidelines, photography, fonts, and templates."
        actions={
          <>
            <Link to="/assets/collections" className="btn btn-secondary">
              Collections
            </Link>
            <Link to="/assets/new" className="btn btn-primary">
              Upload
            </Link>
          </>
        }
      />

      {/* Filters */}
      <div className="space-y-2">
        <AssetSearchBar
          search={search}
          onSearchChange={setSearch}
          activeTags={activeTags}
          onRemoveTag={handleRemoveTag}
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as AssetCategory | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All categories' : c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <input
            placeholder="Client filter"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded border px-2 py-1 text-sm w-40"
          />
          <input
            placeholder="Subsidiary filter"
            value={subsidiaryFilter}
            onChange={(e) => setSubsidiaryFilter(e.target.value)}
            className="rounded border px-2 py-1 text-sm w-40"
          />
        </div>
        {tagSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Popular tags:</span>
            {tagSuggestions.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted/40"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading assets…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <AssetGrid
          items={filtered}
          emptyMessage="No assets match your filters. Try clearing them or upload a new asset."
        />
      )}
    </div>
  );
}
