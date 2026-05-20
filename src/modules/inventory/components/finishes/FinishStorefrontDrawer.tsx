/**
 * FinishStorefrontDrawer
 *
 * Edits a finish's `dawinFinishes` block (the Shopify metaobject payload for
 * `finish`). Independent of the core FinishDetailForm — only the ~64
 * hand-mixed brand finishes need this block; the bulk of the finish library
 * (board, melamine, etc.) leaves it undefined and never publishes.
 *
 * Surfaces:
 *  - All fields from docs/integrations/metaobjects/finish.json
 *  - Live sync status (badge + GID + last-published timestamp + error)
 *  - "Save" → updates the Firestore doc (sync trigger fires automatically)
 *  - "Republish now" → invokes the publishFinishMetaobject callable directly
 *  - "Unpublish" → flips `shouldPublishToShopify=false`; the trigger then
 *    archives the metaobject on Shopify (DRAFT status).
 *  - External link to the live storefront page when synced.
 */

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { X, Save, Loader2, ExternalLink, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { functions } from '@/shared/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { updateFinish } from '../../services/finishLibraryService';
import { draftStorefrontContent } from '@/shared/services/ai/draftStorefront';
import {
  DAWIN_FINISHES_FAMILIES,
  DAWIN_FINISHES_WASHABILITY,
  type DawinFinishesShopifyBlock,
  type DawinFinishesShopifySyncStatus,
  type FinishDocument,
} from '../../types/finishLibrary';

const STOREFRONT_BASE_URL = 'https://dawinfinishes.com';

const SYNC_BADGE: Record<DawinFinishesShopifySyncStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

interface FinishStorefrontDrawerProps {
  finish: FinishDocument;
  onClose: () => void;
}

function defaultBlock(finish: FinishDocument): DawinFinishesShopifyBlock {
  const handleSeed = (finish.name || finish.code || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return {
    family: 'Lime wash',
    handle: handleSeed,
    sheen: 'Matte · 3°',
    sheenValue: 3,
    handCount: 4,
    cureHours: 72,
    description: finish.notes || '',
    shouldPublishToShopify: false,
    published: true,
  } as DawinFinishesShopifyBlock;
}

export function FinishStorefrontDrawer({ finish, onClose }: FinishStorefrontDrawerProps) {
  const { user } = useAuth();
  const existing = finish.dawinFinishes;
  const [block, setBlock] = useState<DawinFinishesShopifyBlock>(existing || defaultBlock(finish));
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function handleDraftWithAI() {
    setError(null);
    setDrafting(true);
    try {
      const result = await draftStorefrontContent({
        entityType: 'finish',
        entityId: finish.id,
        sections: ['description'],
      });
      if (result.drafts.description) {
        setBlock((prev) => ({ ...prev, description: result.drafts.description }));
        setDirty(true);
      } else {
        setError('AI returned no description. Try filling in family / sheen / hand_count first.');
      }
    } catch (e) {
      setError((e as Error).message || 'AI draft failed');
    } finally {
      setDrafting(false);
    }
  }

  useEffect(() => {
    setBlock(existing || defaultBlock(finish));
    setDirty(false);
    setError(null);
  }, [finish.id]);

  function set<K extends keyof DawinFinishesShopifyBlock>(key: K, value: DawinFinishesShopifyBlock[K]) {
    setBlock((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const livePageUrl = useMemo(() => {
    if (!block.handle) return null;
    return `${STOREFRONT_BASE_URL}/finishes/${block.handle}`;
  }, [block.handle]);

  async function handleSave() {
    if (!user?.uid) return;
    setError(null);
    if (!block.handle) return setError('Handle is required (kebab-case slug used in the storefront URL).');
    if (!block.family) return setError('Family is required.');
    if (!finish.hexColor) return setError('Finish hex color is required — set it on the main Edit form first.');
    if (!block.description?.trim()) return setError('Description is required.');
    if (!block.handCount) return setError('Hand count is required.');
    if (!block.cureHours) return setError('Cure hours is required.');

    setSaving(true);
    try {
      await updateFinish(finish.id, { dawinFinishes: block }, user.uid);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRepublish() {
    if (!user?.uid) return;
    setError(null);
    setRepublishing(true);
    try {
      if (dirty) await handleSave();
      const callable = httpsCallable(functions, 'publishFinishMetaobject');
      const result = await callable({ finishId: finish.id, force: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = result.data;
      if (data?.status === 'error') {
        setError(data.message || 'Publish failed');
      }
    } catch (e) {
      setError((e as Error).message || 'Publish failed');
    } finally {
      setRepublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!user?.uid) return;
    if (!confirm('Unpublish this finish from dawinfinishes.com? The page will return 404 within minutes.')) return;
    setError(null);
    setRepublishing(true);
    try {
      await updateFinish(finish.id, { dawinFinishes: { ...block, shouldPublishToShopify: false } }, user.uid);
      setBlock({ ...block, shouldPublishToShopify: false });
    } catch (e) {
      setError((e as Error).message || 'Unpublish failed');
    } finally {
      setRepublishing(false);
    }
  }

  const syncStatus = block.shopifySyncStatus;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <aside className="w-full max-w-xl bg-white shadow-2xl flex flex-col max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Storefront · {finish.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              dawinfinishes.com publish settings ·{' '}
              <code className="font-mono">{finish.code}</code>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1">
          {/* Sync status banner */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-gray-500">Sync status</span>
                {syncStatus ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${SYNC_BADGE[syncStatus]}`}>
                    {syncStatus}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">never published</span>
                )}
              </div>
              {livePageUrl && block.shopifyMetaobjectGid && (
                <a
                  href={livePageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  View live <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {block.shopifyLastPublishedAt && (
              <div className="mt-2 text-xs text-gray-500">
                Last published:{' '}
                {block.shopifyLastPublishedAt.toDate
                  ? block.shopifyLastPublishedAt.toDate().toLocaleString()
                  : String(block.shopifyLastPublishedAt)}
              </div>
            )}
            {block.shopifyMetaobjectGid && (
              <div className="mt-1 text-xs text-gray-400 font-mono break-all">
                {block.shopifyMetaobjectGid}
              </div>
            )}
            {block.shopifySyncError && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{block.shopifySyncError}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* URL handle + family */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Handle *</label>
              <input
                value={block.handle || ''}
                onChange={(e) => set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="kyambogo-bone"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">URL: /finishes/<strong>{block.handle || 'handle'}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Family *</label>
              <select
                value={block.family}
                onChange={(e) => set('family', e.target.value as DawinFinishesShopifyBlock['family'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {DAWIN_FINISHES_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hex preview */}
          <div className="rounded-lg border border-gray-200 p-3 flex items-center gap-3">
            <div
              className="w-12 h-12 rounded border border-gray-300"
              style={{ backgroundColor: finish.hexColor || '#ccc' }}
            />
            <div className="text-sm">
              <div className="font-medium">{finish.name}</div>
              <div className="text-xs text-gray-500 font-mono">{finish.hexColor || '— (set on main Edit form)'}</div>
            </div>
          </div>

          {/* Sheen + hand count + cure */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sheen label *</label>
              <input
                value={block.sheen || ''}
                onChange={(e) => set('sheen', e.target.value)}
                placeholder="Matte · 3°"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sheen GU</label>
              <input
                type="number" min={0} max={100}
                value={block.sheenValue ?? ''}
                onChange={(e) => set('sheenValue', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hand count *</label>
              <input
                type="number" min={1}
                value={block.handCount ?? ''}
                onChange={(e) => set('handCount', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cure hours *</label>
              <input
                type="number" min={0}
                value={block.cureHours ?? ''}
                onChange={(e) => set('cureHours', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cure °C min</label>
              <input
                type="number"
                value={block.cureTempCMin ?? ''}
                onChange={(e) => set('cureTempCMin', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cure °C max</label>
              <input
                type="number"
                value={block.cureTempCMax ?? ''}
                onChange={(e) => set('cureTempCMax', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Coverage + washability + outdoor */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coverage m²/kg</label>
              <input
                type="number" step="0.1"
                value={block.coverageM2PerKg ?? ''}
                onChange={(e) => set('coverageM2PerKg', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Washability</label>
              <select
                value={block.washability || ''}
                onChange={(e) => set('washability', (e.target.value || undefined) as DawinFinishesShopifyBlock['washability'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">—</option>
                {DAWIN_FINISHES_WASHABILITY.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center text-sm pb-2">
                <input
                  type="checkbox"
                  checked={!!block.outdoorUse}
                  onChange={(e) => set('outdoorUse', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">Outdoor use</span>
              </label>
            </div>
          </div>

          {/* Sample order */}
          <div className="border-t pt-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Sample order</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sample SKU</label>
                <input
                  value={block.sampleSku || ''}
                  onChange={(e) => set('sampleSku', e.target.value)}
                  placeholder="DF-SMP-LW-011"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price UGX</label>
                <input
                  type="number"
                  value={block.samplePriceUgx ?? ''}
                  onChange={(e) => set('samplePriceUgx', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead days</label>
                <input
                  type="number"
                  value={block.sampleLeadDays ?? ''}
                  onChange={(e) => set('sampleLeadDays', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Description *</label>
              <button
                type="button"
                onClick={handleDraftWithAI}
                disabled={drafting}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded disabled:opacity-50"
                title="Draft with Claude using the finish's family, sheen, hand count, and cure data"
              >
                {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Draft with AI
              </button>
            </div>
            <textarea
              rows={4}
              value={block.description || ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Hand-mixed lime wash from the Kyambogo workshop. Bone tone with subtle warmth…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">Plain text — converted to Shopify Slate rich-text on publish.</p>
          </div>

          {/* Wall preview URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wall preview image URL</label>
            <input
              type="url"
              value={block.wallPreviewImageUrl || ''}
              onChange={(e) => set('wallPreviewImageUrl', e.target.value)}
              placeholder="https://firebasestorage.googleapis.com/…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              16:10 staged shot. Uploaded to Shopify CDN on publish; original stays in Firebase Storage.
            </p>
          </div>

          {/* Flags */}
          <div className="border-t pt-4 space-y-3">
            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.published}
                onChange={(e) => set('published', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="font-medium">Published</span>
                <span className="block text-xs text-gray-500">Visible on the storefront (otherwise creates as DRAFT in Shopify).</span>
              </span>
            </label>
            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.shouldPublishToShopify}
                onChange={(e) => set('shouldPublishToShopify', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="font-medium">Publish to dawinfinishes.com</span>
                <span className="block text-xs text-gray-500">The publish gate — when on, every save fires the sync to Shopify within ~15s.</span>
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {block.shopifyMetaobjectGid && (
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={republishing}
                className="px-3 py-2 text-sm font-medium text-rose-700 bg-white border border-rose-300 rounded-lg hover:bg-rose-50 disabled:opacity-50"
              >
                Unpublish
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRepublish}
              disabled={republishing || !block.shouldPublishToShopify}
              title={!block.shouldPublishToShopify ? 'Enable "Publish to dawinfinishes.com" first' : ''}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {republishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Republish now
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
