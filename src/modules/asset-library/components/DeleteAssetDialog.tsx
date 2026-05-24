/**
 * DeleteAssetDialog — confirmation modal for hard-deleting an asset.
 *
 * Hard-deletes are admin-only at the Firestore rules layer; if a
 * non-admin user reaches this dialog, the `onConfirm` call will
 * surface a "permission denied" error which we render inline. The
 * dialog also requires the user to type the asset name to confirm —
 * a small belt-and-braces to stop accidental destructive clicks.
 */

import { useState } from 'react';

interface Props {
  open: boolean;
  assetName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAssetDialog({ open, assetName, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const matches = typed.trim() === assetName.trim();

  async function handleConfirm() {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setDeleting(false);
    }
  }

  function handleCancel() {
    setTyped('');
    setError(null);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-zeusNavy-dark/40"
        onClick={handleCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-card p-5 shadow-xl">
        <header className="mb-3">
          <h2 className="text-base font-semibold text-zeusRed-dark">Delete asset</h2>
          <p className="mt-1 text-sm text-zeusNavy/80">
            This permanently removes <span className="font-medium">{assetName}</span> from the
            library, including all versions and the underlying storage
            files. Existing share links return 410 Gone immediately.
          </p>
        </header>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-zeusNavy/80">
            Type the asset name to confirm:
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm focus:border-zeusRed focus:outline-none"
            placeholder={assetName}
          />
        </div>

        {error && (
          <p className="mt-3 rounded border border-zeusRed-light bg-zeusRed-50 p-2 text-xs text-zeusRed-dark">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-zeusNavy-100 px-3 py-1.5 text-sm text-zeusNavy hover:bg-zeusNavy-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!matches || deleting}
            className="rounded bg-zeusRed px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zeusRed-dark disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
