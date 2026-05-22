/**
 * /assets/collections — list of curated collections with a quick-create form.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listCollections,
  createCollection,
} from '../services/asset-collection.service';
import type { AssetCollection } from '../types/asset-collection.types';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<AssetCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubsidiary, setNewSubsidiary] = useState('zeus-the-agency');

  async function reload() {
    try {
      setLoading(true);
      setCollections(await listCollections());
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createCollection({
      name: newName.trim(),
      itemIds: [],
      subsidiaryOrgId: newSubsidiary,
      createdBy: 'current-user',
    });
    setNewName('');
    setCreating(false);
    await reload();
  }

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/assets" className="hover:underline">Asset Library</Link> › Collections
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Curated groupings of assets — brand packs, lookbooks, template sets.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          {creating ? 'Cancel' : 'New Collection'}
        </button>
      </header>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-2 rounded border p-3"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted-foreground mb-1">Name</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Coca-Cola brand pack 2026"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Subsidiary</label>
            <input
              required
              value={newSubsidiary}
              onChange={(e) => setNewSubsidiary(e.target.value)}
              className="rounded border px-2 py-1 text-sm w-44"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Create
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading collections…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && collections.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No collections yet. Create one above to start grouping assets.
        </div>
      )}

      {!loading && collections.length > 0 && (
        <ul className="divide-y rounded border">
          {collections.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between p-3 hover:bg-muted/20"
            >
              <div>
                <Link
                  to={`/assets/collections/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {c.itemIds.length} items
                  {c.clientId ? ` · Client: ${c.clientId}` : ''}
                  {' · '}{c.subsidiaryOrgId}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
