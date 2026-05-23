/**
 * /assets/collections/:colId — items inside a single collection.
 *
 * Shows the asset grid for items already in the collection and lets
 * staff remove items inline or add an existing asset by ID. Bulk-pick
 * UX is deferred to a follow-up PR.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getCollection,
  addItemToCollection,
  removeItemFromCollection,
} from '../services/asset-collection.service';
import { getAsset } from '../services/asset-item.service';
import type { AssetCollection } from '../types/asset-collection.types';
import type { AssetItem } from '../types/asset-item.types';
import { AssetGrid } from '../components/AssetGrid';
import { ShareLinkDialog } from '../components/ShareLinkDialog';

export default function CollectionDetailPage() {
  const { colId } = useParams<{ colId: string }>();
  const [collection, setCollection] = useState<AssetCollection | null>(null);
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addId, setAddId] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  async function reload() {
    if (!colId) return;
    try {
      setLoading(true);
      const col = await getCollection(colId);
      setCollection(col);
      if (col) {
        // Fetch each member asset; in Phase 5 we'll batch with `in` queries.
        const fetched = await Promise.all(col.itemIds.map((id) => getAsset(id)));
        setItems(fetched.filter((it): it is AssetItem => Boolean(it)));
      }
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [colId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!colId || !addId.trim()) return;
    await addItemToCollection(colId, addId.trim());
    setAddId('');
    await reload();
  }

  async function handleRemove(itemId: string) {
    if (!colId) return;
    await removeItemFromCollection(colId, itemId);
    await reload();
  }

  if (loading)     return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (error)       return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!collection) return <p className="p-6 text-sm text-muted-foreground">Collection not found.</p>;

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/assets" className="hover:underline">Asset Library</Link>
        {' › '}
        <Link to="/assets/collections" className="hover:underline">Collections</Link>
        {' › '}
        {collection.name}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{collection.name}</h1>
          {collection.description && (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {collection.itemIds.length} items · {collection.subsidiaryOrgId}
            {collection.clientId ? ` · Client: ${collection.clientId}` : ''}
          </p>
        </div>
        <button
          onClick={() => setShareDialogOpen(true)}
          className="rounded bg-zeusRed px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zeusRed-dark"
        >
          Share with client
        </button>
      </header>

      <ShareLinkDialog
        open={shareDialogOpen}
        target={{ kind: 'collection', collectionId: collection.id }}
        targetName={collection.name}
        onClose={() => setShareDialogOpen(false)}
      />

      <form
        onSubmit={handleAdd}
        className="flex items-end gap-2 rounded border p-3"
      >
        <div className="flex-1">
          <label className="block text-xs text-muted-foreground mb-1">
            Add asset by ID
          </label>
          <input
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="asset-item-id"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Add
        </button>
      </form>

      <AssetGrid
        items={items}
        emptyMessage="No assets in this collection yet. Add one using the form above."
      />

      {items.length > 0 && (
        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Remove items</p>
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => handleRemove(it.id)}
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted/40"
                title="Remove from collection"
              >
                {it.name} ✕
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
