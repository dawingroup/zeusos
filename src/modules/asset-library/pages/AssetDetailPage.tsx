/**
 * /assets/:itemId — full asset detail with tabbed Versions / Usages views.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getAsset,
  listAssetUsages,
  archiveAsset,
  deleteAsset,
} from '../services/asset-item.service';
import {
  listVersions,
  rollbackToVersion,
} from '../services/asset-version.service';
import type { AssetItem } from '../types/asset-item.types';
import type { AssetVersion } from '../types/asset-version.types';
import type { AssetUsage } from '../types/asset-usage.types';
import { AssetCategoryBadge } from '../components/AssetCategoryBadge';
import { AssetVersionList } from '../components/AssetVersionList';
import { AssetUsageList } from '../components/AssetUsageList';
import { ShareLinkDialog } from '../components/ShareLinkDialog';
import { DeleteAssetDialog } from '../components/DeleteAssetDialog';

type Tab = 'info' | 'versions' | 'usages';

export default function AssetDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<AssetItem | null>(null);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [usages, setUsages] = useState<AssetUsage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function reload() {
    if (!itemId) return;
    try {
      const [it, vs, us] = await Promise.all([
        getAsset(itemId),
        listVersions(itemId),
        listAssetUsages(itemId),
      ]);
      setItem(it);
      setVersions(vs);
      setUsages(us);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [itemId]);

  async function handleRollback(versionId: string) {
    if (!itemId) return;
    await rollbackToVersion(itemId, versionId);
    await reload();
  }

  async function handleArchive() {
    if (!itemId) return;
    await archiveAsset(itemId);
    await reload();
  }

  async function handleDelete() {
    if (!itemId) return;
    await deleteAsset(itemId);
    // Storage tree cleanup happens server-side via onAssetDeleted.
    navigate('/assets');
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (error)   return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!item)   return <p className="p-6 text-sm text-muted-foreground">Asset not found.</p>;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'info',     label: 'Info' },
    { id: 'versions', label: `Versions (${versions.length})` },
    { id: 'usages',   label: `Used in (${usages.length})` },
  ];

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/assets" className="hover:underline">Asset Library</Link> › {item.name}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{item.name}</h1>
            <AssetCategoryBadge category={item.category} />
          </div>
          <p className="text-sm text-muted-foreground">
            {item.subsidiaryOrgId}
            {item.clientId ? ` · Client: ${item.clientId}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShareDialogOpen(true)}
            className="rounded bg-zeusRed px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zeusRed-dark"
          >
            Share with client
          </button>
          <Link
            to={`/assets/${item.id}/edit`}
            className="rounded border border-zeusNavy-100 px-3 py-1.5 text-sm text-zeusNavy hover:bg-zeusNavy-50"
          >
            Edit
          </Link>
          {item.status !== 'ARCHIVED' && (
            <button
              onClick={handleArchive}
              className="rounded border border-zeusNavy-100 px-3 py-1.5 text-sm text-zeusNavy hover:bg-zeusNavy-50"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="rounded border border-zeusRed-light px-3 py-1.5 text-sm text-zeusRed-dark hover:bg-zeusRed-50"
          >
            Delete
          </button>
        </div>
      </header>

      <ShareLinkDialog
        open={shareDialogOpen}
        target={{ kind: 'asset', assetItemId: item.id }}
        targetName={item.name}
        onClose={() => setShareDialogOpen(false)}
      />
      <DeleteAssetDialog
        open={deleteDialogOpen}
        assetName={item.name}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />

      {/* Tabs */}
      <div className="border-b flex gap-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="aspect-square rounded border bg-muted/40 flex items-center justify-center overflow-hidden">
            {item.previewUrl || item.thumbnailUrl || item.thumbnailRef ? (
              <img
                src={item.previewUrl ?? item.thumbnailUrl ?? item.thumbnailRef}
                alt={item.name}
                className="object-contain max-h-full max-w-full"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                Preview not available
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status',      value: item.status },
              { label: 'File type',   value: item.fileType },
              { label: 'Dimensions',  value: item.dimensions ?? '—' },
              {
                label: 'Size',
                value: `${(item.fileSizeBytes / 1024).toFixed(1)} KB`,
              },
              { label: 'Storage ref', value: item.storageRef },
              { label: 'Uploaded by', value: item.uploadedBy },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium break-all">{value}</dd>
              </div>
            ))}
            {item.tags.length > 0 && (
              <div className="col-span-2 rounded border p-2">
                <dt className="text-xs text-muted-foreground mb-1">Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      #{t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {activeTab === 'versions' && (
        <AssetVersionList
          versions={versions}
          currentVersionId={item.currentVersionId}
          onRollback={handleRollback}
        />
      )}

      {activeTab === 'usages' && <AssetUsageList usages={usages} />}
    </div>
  );
}
