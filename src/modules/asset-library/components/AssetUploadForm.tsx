/**
 * AssetUploadForm — slide-over for uploading a new asset.
 *
 * Phase 5.C: the file is uploaded to Cloud Storage at
 * `asset-library/{itemId}/source/{fileName}`. The `onAssetUploaded`
 * trigger fires on raster images and writes `thumbnailUrl` /
 * `previewUrl` back onto the doc.
 */

import { useState } from 'react';
import type {
  AssetCategory,
  AssetFileType,
  AssetItem,
} from '../types/asset-item.types';

const CATEGORIES: AssetCategory[] = [
  'LOGO',
  'GUIDELINE',
  'PHOTO',
  'VIDEO',
  'FONT',
  'COLOR_PALETTE',
  'TEMPLATE',
  'OTHER',
];

const FILE_TYPES: AssetFileType[] = [
  'IMAGE',
  'VIDEO',
  'PDF',
  'FONT',
  'ARCHIVE',
  'OFFICE',
  'OTHER',
];

/**
 * Header-only fields the caller fills in (the storage path + size are
 * derived from the picked File and resolved by `createAssetWithUpload`).
 */
export type AssetUploadInput = Omit<
  AssetItem,
  'id' | 'createdAt' | 'updatedAt' | 'storageRef' | 'fileSizeBytes' | 'thumbnailUrl' | 'previewUrl'
>;

interface Props {
  open: boolean;
  defaultSubsidiaryOrgId?: string;
  onClose: () => void;
  /** Called with the doc-side fields plus the raw File to upload. */
  onSave: (values: AssetUploadInput, file: File) => Promise<void>;
}

export function AssetUploadForm({
  open,
  defaultSubsidiaryOrgId,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('LOGO');
  const [fileType, setFileType] = useState<AssetFileType>('IMAGE');
  const [clientId, setClientId] = useState('');
  const [subsidiaryOrgId, setSubsidiaryOrgId] = useState(
    defaultSubsidiaryOrgId ?? 'zeus-the-agency',
  );
  const [tagsRaw, setTagsRaw] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailRef, setThumbnailRef] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Please pick a file to upload.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave(
        {
          name,
          category,
          clientId: clientId || undefined,
          subsidiaryOrgId,
          tags,
          // Initial-upload version is "v1"; the actual versionId is
          // assigned by Firestore on the first addVersion call.
          currentVersionId: 'v1',
          thumbnailRef: thumbnailRef || undefined,
          fileType,
          dimensions: dimensions || undefined,
          status: 'ACTIVE',
          uploadedBy: 'current-user', // replaced by auth context in real implementation
        },
        file,
      );
      onClose();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Upload Asset</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 p-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="e.g. Coca-Cola Master Logo — Knockout"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">File Type</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as AssetFileType)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                {FILE_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Client (optional)</label>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                placeholder="client-id"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subsidiary</label>
              <input
                required
                value={subsidiaryOrgId}
                onChange={(e) => setSubsidiaryOrgId(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                placeholder="zeus-the-agency"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tags (comma-separated)
            </label>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="logo, master, monochrome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">File</label>
            <input
              type="file"
              onChange={handleFilePick}
              className="w-full text-sm"
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Raster images get auto-generated thumbnails. PDFs, videos and
              fonts upload as-is.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Thumbnail URL (optional)
            </label>
            <input
              value={thumbnailRef}
              onChange={(e) => setThumbnailRef(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="thumbnails/pending/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Dimensions (optional)
            </label>
            <input
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="1920x1080 or A4"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !file}
              className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
            >
              {saving ? 'Uploading…' : 'Save Asset'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
