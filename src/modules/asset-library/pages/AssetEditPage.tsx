/**
 * /assets/:itemId/edit — full-page edit form for an existing asset.
 *
 * Reuses `AssetForm` in edit mode. On submit:
 *   - `updateAsset` writes the header fields (name, tags, category,
 *     subsidiary, etc.).
 *   - If the user picked a replacement file, `replaceAssetSource`
 *     uploads to `asset-library/{itemId}/source/{newName}`, points the
 *     doc at it, and clears the cached thumbnail URLs (the
 *     `onAssetUploaded` Cloud Function regenerates them).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { AssetForm, type AssetFormValues } from '../components/AssetForm';
import {
  getAsset,
  replaceAssetSource,
  updateAsset,
} from '../services/asset-item.service';
import type { AssetItem } from '../types/asset-item.types';

export default function AssetEditPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [item, setItem] = useState<AssetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!itemId) return;
      try {
        const fetched = await getAsset(itemId);
        if (!cancelled) setItem(fetched);
      } catch (err) {
        if (!cancelled) setError(String((err as Error).message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [itemId]);

  async function handleSubmit(values: AssetFormValues, file: File | null) {
    if (!itemId) return;
    // Replace the source first so the storageRef / thumbnail-clear
    // happens before the header write — keeps the doc internally
    // consistent if one of the two fails.
    if (file) {
      await replaceAssetSource(itemId, file);
    }
    await updateAsset(itemId, values);
    navigate(`/assets/${itemId}`);
  }

  if (authLoading || loading) {
    return <p className="p-6 text-sm text-zeusNavy/70">Loading…</p>;
  }
  if (error) {
    return <p className="p-6 text-sm text-zeusRed-dark">Error: {error}</p>;
  }
  if (!item) {
    return <p className="p-6 text-sm text-zeusNavy/70">Asset not found.</p>;
  }
  if (!user) {
    return (
      <p className="p-6 text-sm text-zeusRed-dark">
        You must be signed in to edit assets.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <nav className="text-sm text-zeusNavy/70">
        <Link to="/assets" className="hover:underline">Asset Library</Link>
        {' › '}
        <Link to={`/assets/${item.id}`} className="hover:underline">
          {item.name}
        </Link>
        {' › '}
        Edit
      </nav>

      <header>
        <h1 className="text-xl font-semibold text-zeusNavy">Edit Asset</h1>
        <p className="text-sm text-zeusNavy/70">
          Update header fields, or pick a new file to replace the source.
        </p>
      </header>

      <AssetForm
        mode="edit"
        initialValues={item}
        currentUserId={user.uid}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/assets/${item.id}`)}
      />
    </div>
  );
}
