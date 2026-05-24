/**
 * ShareLinkDialog — modal for creating a public share link to an asset
 * or a collection.
 *
 * Mounts inside AssetDetailPage / CollectionDetailPage. Calls
 * `createShareLink`, then surfaces the resulting URL with a
 * copy-to-clipboard button.
 */

import { useState } from 'react';
import {
  buildShareUrl,
  createShareLink,
} from '../services/share-link.service';
import type { ShareLinkTarget } from '../types/share-link.types';

interface Props {
  open: boolean;
  target: ShareLinkTarget;
  /** Free-form label shown to staff in the share history view. */
  targetName: string;
  onClose: () => void;
}

const TTL_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days (default)', value: 14 },
  { label: '30 days', value: 30 },
  { label: '90 days (max)', value: 90 },
];

export function ShareLinkDialog({
  open,
  target,
  targetName,
  onClose,
}: Props) {
  const [allowDownload, setAllowDownload] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const link = await createShareLink(target, {
        allowDownload,
        expiresInDays,
        label: targetName,
      });
      setShareUrl(buildShareUrl(link.token));
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / non-secure contexts — surface a manual fallback.
      setError('Could not copy automatically. Select the URL and copy manually.');
    }
  }

  function handleClose() {
    setShareUrl(null);
    setAllowDownload(true);
    setExpiresInDays(14);
    setError(null);
    setCopied(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-zeusNavy-dark/40"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-card p-5 shadow-xl">
        <header className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zeusNavy">
              Share with client
            </h2>
            <p className="text-xs text-zeusNavy/60">{targetName}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-zeusNavy/60 hover:text-zeusNavy"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {!shareUrl ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zeusNavy/80">
                Expires in
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full rounded border border-zeusNavy-100 px-2 py-1.5 text-sm"
              >
                {TTL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-zeusNavy">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
              />
              Allow recipient to download (uncheck for preview-only)
            </label>

            {error && (
              <p className="rounded border border-zeusRed-light bg-zeusRed-50 p-2 text-xs text-zeusRed-dark">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="rounded border border-zeusNavy-100 px-3 py-1.5 text-sm text-zeusNavy hover:bg-zeusNavy-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="rounded bg-zeusRed px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zeusRed-dark disabled:opacity-60"
              >
                {creating ? 'Generating…' : 'Create share link'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zeusNavy">
              Anyone with this link can view {target.kind === 'collection' ? 'this collection' : 'this asset'}
              {' '}for the next {expiresInDays} days.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded border border-zeusNavy-100 bg-zeusNavy-50 px-2 py-1.5 font-mono text-xs text-zeusNavy"
              />
              <button
                onClick={handleCopy}
                className="rounded bg-zeusNavy px-3 py-1.5 text-sm text-white shadow-sm hover:bg-zeusNavy-dark"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {error && (
              <p className="rounded border border-zeusRed-light bg-zeusRed-50 p-2 text-xs text-zeusRed-dark">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="rounded border border-zeusNavy-100 px-3 py-1.5 text-sm text-zeusNavy hover:bg-zeusNavy-50"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
