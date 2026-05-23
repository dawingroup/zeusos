/**
 * /assets/new — full-page create form for a new Asset Library item.
 *
 * Uses the shared `AssetForm` component in create mode. On submit:
 *   1. `createAssetWithUpload` reserves a Firestore id, uploads the
 *      file to `asset-library/{itemId}/source/{name}`, and writes the
 *      AssetItem doc.
 *   2. The `onAssetUploaded` Cloud Function fires on raster images
 *      and asynchronously populates `thumbnailUrl` / `previewUrl`.
 *   3. We navigate to the detail page so the user lands on the row
 *      they just created.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { AssetForm, type AssetFormValues } from '../components/AssetForm';
import { createAssetWithUpload } from '../services/asset-item.service';

export default function AssetUploadPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  async function handleSubmit(values: AssetFormValues, file: File | null) {
    if (!file) throw new Error('A file is required to create an asset.');
    const created = await createAssetWithUpload(values, file);
    navigate(`/assets/${created.id}`);
  }

  if (loading) {
    return <p className="p-6 text-sm text-zeusNavy/70">Loading…</p>;
  }
  if (!user) {
    return (
      <p className="p-6 text-sm text-zeusRed-dark">
        You must be signed in to upload assets.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <nav className="text-sm text-zeusNavy/70">
        <Link to="/assets" className="hover:underline">Asset Library</Link>
        {' › '}
        Upload
      </nav>

      <header>
        <h1 className="text-xl font-semibold text-zeusNavy">Upload Asset</h1>
        <p className="text-sm text-zeusNavy/70">
          The file lands in Cloud Storage and is indexed for the library.
          Raster images auto-generate 200px and 800px thumbnails.
        </p>
      </header>

      <AssetForm
        mode="create"
        currentUserId={user.uid}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/assets')}
      />
    </div>
  );
}
