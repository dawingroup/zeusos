/**
 * /share/:token — public viewer for a single asset OR a collection.
 *
 * Phase 5.C "shareable client link" — recipients open this URL without
 * logging in. The page:
 *   1. Calls the `resolveShareLink` HTTPS Cloud Function with the
 *      token from the URL.
 *   2. Renders the asset (or collection gallery) with a 1-hour signed
 *      Storage URL.
 *
 * No AppShell, no AuthGuard. Lightweight layout — the recipient is a
 * client / external reviewer, not a Zeus staff user.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/** Region must match the function's deploy region (europe-west1). */
const RESOLVER_URL =
  'https://europe-west1-zeusos.cloudfunctions.net/resolveShareLink';

interface ResolvedAsset {
  id: string;
  name: string;
  category: string;
  fileType: string;
  fileSizeBytes: number;
  dimensions: string | null;
  storageRef: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  signedUrl?: string;
}

interface ResolvedCollection {
  id: string;
  name: string;
  description: string | null;
  itemIds: string[];
}

type ResolverResponse =
  | {
      kind: 'asset';
      asset: ResolvedAsset;
      signedUrl: string;
      allowDownload: boolean;
      expiresAt: string;
    }
  | {
      kind: 'collection';
      collection: ResolvedCollection;
      items: ResolvedAsset[];
      allowDownload: boolean;
      expiresAt: string;
    };

export default function SharedAssetPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ResolverResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setError('No share token in the URL.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${RESOLVER_URL}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          // Resolver returns structured 4xx; surface the message verbatim.
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Share link unavailable (${res.status}).`);
          return;
        }
        const json = (await res.json()) as ResolverResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(String((err as Error).message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-zeusNavy-50">
      <header className="border-b border-zeusNavy-100 bg-card px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-zeusNavy">Zeus Group</span>
            <span className="h-4 w-px bg-zeusNavy-100" aria-hidden="true" />
            <span className="text-xs uppercase tracking-wide text-zeusNavy/70">
              Shared asset
            </span>
          </div>
          {data && (
            <p className="text-xs text-zeusNavy/60">
              Link valid until {new Date(data.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {loading && (
          <p className="text-sm text-zeusNavy/70">Loading shared asset…</p>
        )}
        {error && (
          <div className="rounded border border-zeusRed-light bg-zeusRed-50 p-4 text-sm text-zeusRed-dark">
            {error}
          </div>
        )}
        {data?.kind === 'asset' && (
          <AssetViewer asset={data.asset} signedUrl={data.signedUrl} allowDownload={data.allowDownload} />
        )}
        {data?.kind === 'collection' && (
          <CollectionViewer
            collection={data.collection}
            items={data.items}
            allowDownload={data.allowDownload}
          />
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-zeusNavy/50">
        Shared via ZeusOS · contact your Zeus account manager if this link
        has expired.
      </footer>
    </div>
  );
}

function AssetViewer({
  asset,
  signedUrl,
  allowDownload,
}: {
  asset: ResolvedAsset;
  signedUrl: string;
  allowDownload: boolean;
}) {
  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zeusNavy">{asset.name}</h1>
        <p className="text-sm text-zeusNavy/70">
          {asset.category} · {asset.fileType}
          {asset.dimensions ? ` · ${asset.dimensions}` : ''} ·{' '}
          {(asset.fileSizeBytes / 1024).toFixed(1)} KB
        </p>
      </header>

      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-zeusNavy-100 bg-card p-4 shadow-sm">
        <AssetInlinePreview asset={asset} signedUrl={signedUrl} />
      </div>

      {allowDownload && (
        <div className="flex justify-end">
          <a
            href={signedUrl}
            className="rounded bg-zeusNavy px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zeusNavy-dark"
          >
            Download
          </a>
        </div>
      )}
    </article>
  );
}

function CollectionViewer({
  collection,
  items,
  allowDownload,
}: {
  collection: ResolvedCollection;
  items: ResolvedAsset[];
  allowDownload: boolean;
}) {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zeusNavy">{collection.name}</h1>
        {collection.description && (
          <p className="text-sm text-zeusNavy/70">{collection.description}</p>
        )}
        <p className="text-xs text-zeusNavy/50">{items.length} items</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col overflow-hidden rounded-lg border border-zeusNavy-100 bg-card shadow-sm"
          >
            <div className="aspect-square bg-zeusNavy-50/40 p-3">
              <AssetInlinePreview asset={item} signedUrl={item.signedUrl ?? ''} />
            </div>
            <div className="space-y-1 border-t border-zeusNavy-100 p-3">
              <p className="truncate text-sm font-medium text-zeusNavy">{item.name}</p>
              <p className="text-xs text-zeusNavy/60">
                {item.category} · {(item.fileSizeBytes / 1024).toFixed(1)} KB
              </p>
              {allowDownload && item.signedUrl && (
                <a
                  href={item.signedUrl}
                  className="inline-block text-xs font-medium text-zeusRed hover:underline"
                >
                  Download
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Render the asset based on its file type. Images go inline; PDFs into
 * an iframe; everything else gets a download nudge.
 */
function AssetInlinePreview({ asset, signedUrl }: { asset: ResolvedAsset; signedUrl: string }) {
  if (!signedUrl) {
    return <p className="text-sm text-zeusNavy/70">Preview unavailable.</p>;
  }
  if (asset.fileType === 'IMAGE') {
    return (
      <img
        src={asset.previewUrl || signedUrl}
        alt={asset.name}
        className="max-h-full max-w-full object-contain"
      />
    );
  }
  if (asset.fileType === 'PDF') {
    return (
      <iframe
        src={signedUrl}
        title={asset.name}
        className="h-[480px] w-full rounded border border-zeusNavy-100"
      />
    );
  }
  if (asset.fileType === 'VIDEO') {
    return (
      <video
        src={signedUrl}
        controls
        className="max-h-[480px] max-w-full rounded border border-zeusNavy-100"
      />
    );
  }
  // FONT / ARCHIVE / OFFICE / OTHER — no inline preview; recipient just downloads.
  return (
    <div className="flex h-full items-center justify-center text-center text-sm text-zeusNavy/70">
      Inline preview not supported for this file type. Use the Download
      button to view.
    </div>
  );
}
