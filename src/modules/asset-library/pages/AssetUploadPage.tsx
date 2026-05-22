/**
 * /assets/new — minimal upload page wrapping the AssetUploadForm slide-over.
 *
 * On save: writes the AssetItem and navigates back to the list. Cloud
 * Storage upload is Phase 5; the form just records `storageRef` as a
 * string.
 */

import { useNavigate, Link } from 'react-router-dom';
import {
  AssetUploadForm,
  type AssetUploadInput,
} from '../components/AssetUploadForm';
import { createAsset } from '../services/asset-item.service';

export default function AssetUploadPage() {
  const navigate = useNavigate();

  async function handleSave(values: AssetUploadInput) {
    await createAsset(values);
    navigate('/assets');
  }

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/assets" className="hover:underline">Asset Library</Link> › Upload
      </nav>

      <header>
        <h1 className="text-xl font-semibold">Upload Asset</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the details below. File upload to Cloud Storage is wired in Phase 5;
          for now the storage reference is recorded as a string.
        </p>
      </header>

      <AssetUploadForm
        open
        onClose={() => navigate('/assets')}
        onSave={handleSave}
      />
    </div>
  );
}
