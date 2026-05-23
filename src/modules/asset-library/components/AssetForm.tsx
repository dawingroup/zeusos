/**
 * AssetForm — shared create / edit form for the Asset Library.
 *
 * Two modes:
 *   - `mode="create"` requires the user to pick a File. `onSubmit` is
 *     called with `(values, file)` — the page passes both to
 *     `createAssetWithUpload`.
 *   - `mode="edit"` pre-fills from `initialValues`; the file picker is
 *     optional. `onSubmit` is called with `(values, file | null)` —
 *     `null` means "no new file, just update header fields".
 *
 * The form is page-laid-out (no slide-over). Each section has a small
 * heading so the page reads cleanly when used as the entire route
 * body (not as a modal overlay).
 */

import { useState } from 'react';
import type {
  AssetCategory,
  AssetFileType,
  AssetItem,
  AssetStatus,
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

const STATUSES: AssetStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

/** Canonical Zeus sub-brands — mirrors src/shared/components/admin/SubsidiaryBranding.tsx. */
const SUBSIDIARIES = [
  { id: 'zeus-the-agency', label: 'Zeus The Agency' },
  { id: 'zeus-digital',    label: 'Zeus Digital' },
  { id: 'labyrinth',       label: 'Labyrinth' },
  { id: 'odd-gorilla',     label: 'Odd Gorilla' },
  { id: 'house-of-zeus',   label: 'House of Zeus' },
] as const;

/**
 * Header-only payload — `storageRef` / `fileSizeBytes` / thumbnails
 * are resolved by the caller (createAssetWithUpload computes them
 * from the picked File; edit-mode keeps the existing values).
 */
export type AssetFormValues = Omit<
  AssetItem,
  'id' | 'createdAt' | 'updatedAt' | 'storageRef' | 'fileSizeBytes' | 'thumbnailUrl' | 'previewUrl'
>;

interface Props {
  mode: 'create' | 'edit';
  initialValues?: Partial<AssetFormValues>;
  /** Hint for create-mode subsidiary default — usually the current user's home org. */
  defaultSubsidiaryOrgId?: string;
  /** The auth UID of the current user — recorded on `uploadedBy` for new uploads. */
  currentUserId: string;
  /** create: file is required. edit: file is optional (null = no replacement). */
  onSubmit: (values: AssetFormValues, file: File | null) => Promise<void>;
  onCancel: () => void;
}

export function AssetForm({
  mode,
  initialValues,
  defaultSubsidiaryOrgId,
  currentUserId,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(
    initialValues?.category ?? 'LOGO',
  );
  const [fileType, setFileType] = useState<AssetFileType>(
    initialValues?.fileType ?? 'IMAGE',
  );
  const [status, setStatus] = useState<AssetStatus>(
    initialValues?.status ?? 'ACTIVE',
  );
  const [clientId, setClientId] = useState(initialValues?.clientId ?? '');
  const [subsidiaryOrgId, setSubsidiaryOrgId] = useState(
    initialValues?.subsidiaryOrgId ??
      defaultSubsidiaryOrgId ??
      SUBSIDIARIES[0].id,
  );
  const [tagsRaw, setTagsRaw] = useState((initialValues?.tags ?? []).join(', '));
  const [dimensions, setDimensions] = useState(initialValues?.dimensions ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create' && !file) {
      setError('Pick a file to upload.');
      return;
    }
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSubmit(
        {
          name: name.trim(),
          category,
          fileType,
          status,
          clientId: clientId.trim() || undefined,
          subsidiaryOrgId,
          tags,
          dimensions: dimensions.trim() || undefined,
          currentVersionId: initialValues?.currentVersionId ?? 'v1',
          thumbnailRef: initialValues?.thumbnailRef,
          uploadedBy: initialValues?.uploadedBy ?? currentUserId,
        },
        file,
      );
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4 rounded-md border border-zeusNavy-100 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zeusNavy/70">
          Identity
        </h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-zeusNavy">Name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm focus:border-zeusRed focus:outline-none"
            placeholder="e.g. Coca-Cola Master Logo — Knockout"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zeusNavy">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zeusNavy">File type</label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value as AssetFileType)}
              className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
            >
              {FILE_TYPES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-zeusNavy-100 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zeusNavy/70">
          Ownership
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zeusNavy">Subsidiary *</label>
            <select
              required
              value={subsidiaryOrgId}
              onChange={(e) => setSubsidiaryOrgId(e.target.value)}
              className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
            >
              {SUBSIDIARIES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zeusNavy">
              Client (optional)
            </label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
              placeholder="client-id"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zeusNavy">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zeusNavy">
              Dimensions (optional)
            </label>
            <input
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
              placeholder="1920x1080 or A4"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zeusNavy">
            Tags (comma-separated)
          </label>
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
            placeholder="logo, master, monochrome"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-zeusNavy-100 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zeusNavy/70">
          File{mode === 'edit' ? ' (optional replacement)' : ''}
        </h2>
        <input
          type="file"
          onChange={handleFilePick}
          className="block w-full text-sm text-zeusNavy file:mr-3 file:rounded file:border-0 file:bg-zeusNavy file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zeusNavy-dark"
        />
        {file && (
          <p className="text-xs text-zeusNavy/70">
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
        {mode === 'edit' && !file && (
          <p className="text-xs text-zeusNavy/60">
            Keeping the existing file. Pick a new one to replace it.
          </p>
        )}
        <p className="text-xs text-zeusNavy/60">
          Raster images auto-generate 200px / 800px thumbnails seconds after
          upload. PDFs, videos and fonts upload as-is.
        </p>
      </section>

      {error && (
        <p className="rounded border border-zeusRed-light bg-zeusRed-50 p-3 text-sm text-zeusRed-dark">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zeusNavy-100 px-4 py-1.5 text-sm text-zeusNavy hover:bg-zeusNavy-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-zeusRed px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zeusRed-dark disabled:opacity-60"
        >
          {saving
            ? mode === 'create'
              ? 'Uploading…'
              : 'Saving…'
            : mode === 'create'
              ? 'Save asset'
              : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
