/**
 * InventoryStorefrontDrawer
 *
 * Edits an inventory item's `shopify` block — both:
 *   1. PRODUCT enrichment path: the `dawin.*` metafields written onto the
 *      existing Shopify product (workshop_status, lead times, dimensions,
 *      care, warranty, finish_id ref, materials ref, projects_used_in ref).
 *      Schema §4.1. Requires `shopifyProductId` already set on the item.
 *   2. MATERIAL metaobject path: publish the item as a Shopify `material`
 *      metaobject under /materials/{handle}. Schema §4.6. Requires
 *      `materialCategory` in {plaster, timber, metal, fibre, clay, stone, glass}.
 *
 * Mirrors FinishStorefrontDrawer + ProjectCaseStudyStorefrontDrawer in
 * structure and ergonomics.
 */

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { X, Save, Loader2, ExternalLink, RefreshCw, AlertCircle, Info, Sparkles } from 'lucide-react';
import { functions } from '@/shared/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { updateInventoryItem } from '../services/inventoryService';
import { draftStorefrontContent } from '@/shared/services/ai/draftStorefront';
import type { InventoryItem } from '../types/inventory';

const STOREFRONT_BASE_URL = 'https://dawinfinishes.com';

const SYNC_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

const WORKSHOP_STATUSES: Array<'in-stock' | 'made-to-order' | 'draft'> = ['in-stock', 'made-to-order', 'draft'];
const MATERIAL_CATEGORIES: Array<'plaster' | 'timber' | 'metal' | 'fibre' | 'clay' | 'stone' | 'glass'> = [
  'plaster', 'timber', 'metal', 'fibre', 'clay', 'stone', 'glass',
];

interface InventoryStorefrontDrawerProps {
  item: InventoryItem;
  onClose: () => void;
}

type ShopifyBlock = NonNullable<InventoryItem['shopify']>;

function defaultBlock(): ShopifyBlock {
  return {
    shouldPublishAsProduct: false,
    shouldPublishAsMaterial: false,
  };
}

function csv(ids: string[] | undefined): string {
  return (ids || []).join(', ');
}
function parseCsv(s: string): string[] {
  return s.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean);
}

export function InventoryStorefrontDrawer({ item, onClose }: InventoryStorefrontDrawerProps) {
  const { user } = useAuth();
  const existing = item.shopify;
  const [block, setBlock] = useState<ShopifyBlock>(existing || defaultBlock());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState<null | 'material' | 'care'>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function handleDraftMaterial() {
    setError(null);
    setDrafting('material');
    try {
      const result = await draftStorefrontContent({
        entityType: 'material',
        entityId: item.id,
        sections: ['materialDescription'],
      });
      if (result.drafts.materialDescription) {
        setBlock((prev) => ({ ...prev, materialDescription: result.drafts.materialDescription }));
        setDirty(true);
      } else {
        setError('AI returned no description. Fill in origin country / category first.');
      }
    } catch (e) {
      setError((e as Error).message || 'AI draft failed');
    } finally {
      setDrafting(null);
    }
  }

  async function handleDraftCare() {
    setError(null);
    setDrafting('care');
    try {
      const result = await draftStorefrontContent({
        entityType: 'material',
        entityId: item.id,
        sections: ['careInstructions'],
      });
      if (result.drafts.careInstructions) {
        setBlock((prev) => ({ ...prev, careInstructions: result.drafts.careInstructions }));
        setDirty(true);
      } else {
        setError('AI returned no care instructions. Set the material category first.');
      }
    } catch (e) {
      setError((e as Error).message || 'AI draft failed');
    } finally {
      setDrafting(null);
    }
  }

  // CSV-style refs (commit on blur)
  const [materialIdsRaw, setMaterialIdsRaw] = useState(csv((existing?.materialIds as string[] | undefined) || item.linkedMaterialIds));
  const [projectsIdsRaw, setProjectsIdsRaw] = useState(csv(existing?.projectsUsedInIds));

  useEffect(() => {
    setBlock(existing || defaultBlock());
    setDirty(false);
    setError(null);
    setMaterialIdsRaw(csv((existing?.materialIds as string[] | undefined) || item.linkedMaterialIds));
    setProjectsIdsRaw(csv(existing?.projectsUsedInIds));
  }, [item.id]);

  function set<K extends keyof ShopifyBlock>(key: K, value: ShopifyBlock[K]) {
    setBlock((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const materialLiveUrl = useMemo(() => {
    if (!block.materialMetaobjectGid) return null;
    const handle = block.materialHandle || item.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return handle ? `${STOREFRONT_BASE_URL}/materials/${handle}` : null;
  }, [block.materialMetaobjectGid, block.materialHandle, item.name]);

  const productLiveUrl = useMemo(() => {
    if (!item.shopifyProductId || !block.shouldPublishAsProduct) return null;
    // Shopify storefront product URL — uses the product handle, not the GID.
    // We don't have the handle on the inventory item, so just deep-link to the admin product page.
    const numericId = String(item.shopifyProductId).replace(/^.*\//, '');
    return `https://admin.shopify.com/store/dawin-finishes/products/${numericId}`;
  }, [item.shopifyProductId, block.shouldPublishAsProduct]);

  function commitCsv() {
    setBlock((prev) => ({
      ...prev,
      materialIds: parseCsv(materialIdsRaw),
      projectsUsedInIds: parseCsv(projectsIdsRaw),
    }));
    setDirty(true);
  }

  async function persist(next: ShopifyBlock) {
    if (!user?.uid) throw new Error('not signed in');
    await updateInventoryItem(item.id, { shopify: next } as Partial<InventoryItem>, user.uid);
  }

  async function handleSave() {
    if (!user?.uid) return;
    setError(null);
    // Validation for material path
    if (block.shouldPublishAsMaterial) {
      if (!block.materialCategory) return setError('Material category is required.');
      if (!block.originCountry) return setError('Material origin country is required.');
      if (!block.materialDescription?.trim()) return setError('Material description is required.');
    }
    setSaving(true);
    try {
      const payload: ShopifyBlock = {
        ...block,
        materialIds: parseCsv(materialIdsRaw),
        projectsUsedInIds: parseCsv(projectsIdsRaw),
      };
      await persist(payload);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyMetafields() {
    if (!user?.uid) return;
    setError(null);
    setBusy(true);
    try {
      if (dirty) await handleSave();
      const callable = httpsCallable(functions, 'applyProductMetafieldsCallable');
      const result = await callable({ inventoryItemId: item.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = result.data;
      if (data?.status === 'error') setError(data.message || 'Apply failed');
      if (data?.status === 'skipped') setError(`Skipped: ${data.reason}`);
    } catch (e) {
      setError((e as Error).message || 'Apply failed');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishMaterial() {
    if (!user?.uid) return;
    setError(null);
    setBusy(true);
    try {
      if (dirty) await handleSave();
      const callable = httpsCallable(functions, 'publishMaterialMetaobject');
      const result = await callable({ inventoryItemId: item.id, force: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = result.data;
      if (data?.status === 'error') setError(data.message || 'Publish failed');
      if (data?.status === 'skipped') setError(`Skipped: ${data.reason}`);
    } catch (e) {
      setError((e as Error).message || 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublishMaterial() {
    if (!user?.uid) return;
    if (!confirm('Unpublish this material metaobject from dawinfinishes.com?')) return;
    setError(null);
    setBusy(true);
    try {
      await persist({ ...block, shouldPublishAsMaterial: false });
      setBlock({ ...block, shouldPublishAsMaterial: false });
    } catch (e) {
      setError((e as Error).message || 'Unpublish failed');
    } finally {
      setBusy(false);
    }
  }

  const materialSync = block.materialSyncStatus;
  const productHasShopifyLink = !!item.shopifyProductId;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <aside className="w-full max-w-xl bg-white shadow-2xl flex flex-col max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Storefront · {item.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              <code className="font-mono">{item.sku || '(no SKU)'}</code>
              {item.category && <span className="ml-2">· {item.category}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 flex-1">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* =================================================== */}
          {/* MODE A — Product enrichment (dawin.* metafields) */}
          {/* =================================================== */}
          <section className="space-y-4">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  As a product on dawinfinishes.com
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Writes the <code>dawin.*</code> metafields onto the existing Shopify product.
                  Drives the "on the bench" badge, lead-time copy, spec table, and confidence signals.
                </p>
              </div>
              {productLiveUrl && (
                <a href={productLiveUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 flex-shrink-0">
                  Admin <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </header>

            {!productHasShopifyLink && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  This item has no <code>shopifyProductId</code> yet. Push it to Shopify first (see Inventory → Shopify sync),
                  then return here to enrich the metafields.
                </span>
              </div>
            )}

            {/* Status banner */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gray-500">Last metafield write</span>
                {block.metafieldsLastAt ? (
                  <span className="text-xs text-gray-600">
                    {block.metafieldsLastAt.toDate
                      ? block.metafieldsLastAt.toDate().toLocaleString()
                      : String(block.metafieldsLastAt)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">never</span>
                )}
              </div>
              {block.metafieldsLastError && (
                <div className="mt-2 text-xs text-rose-700 break-all">{block.metafieldsLastError}</div>
              )}
            </div>

            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.shouldPublishAsProduct}
                onChange={(e) => set('shouldPublishAsProduct', e.target.checked)}
                disabled={!productHasShopifyLink}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
              />
              <span>
                <span className="font-medium">Publish dawin.* metafields</span>
                <span className="block text-xs text-gray-500">
                  Daily reconciler keeps this product's metafields fresh; "Apply now" pushes them immediately.
                </span>
              </span>
            </label>

            {/* Workshop status + lead time */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workshop status</label>
                <select
                  value={block.workshopStatus || ''}
                  onChange={(e) => set('workshopStatus', (e.target.value || undefined) as ShopifyBlock['workshopStatus'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— (defaults from stock)</option>
                  {WORKSHOP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead time min (days)</label>
                <input type="number" min={0}
                  value={block.leadTimeDaysMin ?? ''}
                  onChange={(e) => set('leadTimeDaysMin', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead time max (days)</label>
                <input type="number" min={0}
                  value={block.leadTimeDaysMax ?? ''}
                  onChange={(e) => set('leadTimeDaysMax', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Workshop provenance */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workshop</label>
                <input
                  value={block.workshop || ''}
                  onChange={(e) => set('workshop', e.target.value)}
                  placeholder="Kyambogo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bench number</label>
                <input
                  value={block.benchNumber || ''}
                  onChange={(e) => set('benchNumber', e.target.value)}
                  placeholder="Bench 03"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch id</label>
                <input
                  value={block.batchId || ''}
                  onChange={(e) => set('batchId', e.target.value)}
                  placeholder="B-26-19-003"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signed by</label>
                <input
                  value={block.signedBy || ''}
                  onChange={(e) => set('signedBy', e.target.value)}
                  placeholder="M. Kalu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hand count</label>
                <input type="number" min={0}
                  value={block.handCount ?? ''}
                  onChange={(e) => set('handCount', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designer id</label>
                <input
                  value={block.designerId || ''}
                  onChange={(e) => set('designerId', e.target.value)}
                  placeholder="optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">W (mm)</label>
                <input type="number" min={0}
                  value={block.dimensionsWmm ?? ''}
                  onChange={(e) => set('dimensionsWmm', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">H (mm)</label>
                <input type="number" min={0}
                  value={block.dimensionsHmm ?? ''}
                  onChange={(e) => set('dimensionsHmm', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">D (mm)</label>
                <input type="number" min={0}
                  value={block.dimensionsDmm ?? ''}
                  onChange={(e) => set('dimensionsDmm', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input type="number" step="0.1" min={0}
                  value={block.weightKg ?? ''}
                  onChange={(e) => set('weightKg', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Origin + warranty */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country of origin</label>
                <input
                  value={block.countryOfOrigin || ''}
                  onChange={(e) => set('countryOfOrigin', e.target.value)}
                  placeholder="Uganda"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warranty (months)</label>
                <input type="number" min={0}
                  value={block.warrantyMonths ?? ''}
                  onChange={(e) => set('warrantyMonths', Number(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Care */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Care instructions</label>
                <button
                  type="button"
                  onClick={handleDraftCare}
                  disabled={drafting !== null}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded disabled:opacity-50"
                  title="Draft care instructions from material category + workshop context"
                >
                  {drafting === 'care' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Draft with AI
                </button>
              </div>
              <textarea
                rows={3}
                value={block.careInstructions || ''}
                onChange={(e) => set('careInstructions', e.target.value)}
                placeholder="Dust with a soft dry cloth. Avoid abrasive cleaners…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* Refs */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finish override (finishLibrary id)</label>
                <input
                  value={block.finishId || ''}
                  onChange={(e) => set('finishId', e.target.value || undefined)}
                  placeholder={item.linkedFinishIds?.[0] ? `defaults to ${item.linkedFinishIds[0]}` : 'optional'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-500 mt-1">Override the auto-linked finish; publisher resolves to a Shopify finish-metaobject GID.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materials (inventoryItems ids)</label>
                <input
                  value={materialIdsRaw}
                  onChange={(e) => setMaterialIdsRaw(e.target.value)}
                  onBlur={commitCsv}
                  placeholder="comma-separated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projects used in (case study ids)</label>
                <input
                  value={projectsIdsRaw}
                  onChange={(e) => setProjectsIdsRaw(e.target.value)}
                  onBlur={commitCsv}
                  placeholder="comma-separated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-500 mt-1">Drives the "Specified for N projects" confidence signal.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe id (formula ref)</label>
                <input
                  value={block.recipeId || ''}
                  onChange={(e) => set('recipeId', e.target.value)}
                  placeholder="optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </section>

          {/* =================================================== */}
          {/* MODE B — Material metaobject */}
          {/* =================================================== */}
          <section className="space-y-4 border-t pt-6">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  As a material on dawinfinishes.com
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Publishes a <code>material</code> metaobject — surfaced from product spec tables and finish library cards.
                  Drives the "100% locally sourced" / sustainable badges.
                </p>
              </div>
              {materialLiveUrl && (
                <a href={materialLiveUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 flex-shrink-0">
                  View live <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </header>

            {/* Sync status banner */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-gray-500">Sync</span>
                {materialSync ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${SYNC_BADGE[materialSync] || 'bg-gray-100'}`}>
                    {materialSync}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">never published</span>
                )}
              </div>
              {block.materialLastPublishedAt && (
                <div className="mt-1 text-xs text-gray-500">
                  Last published:{' '}
                  {block.materialLastPublishedAt.toDate
                    ? block.materialLastPublishedAt.toDate().toLocaleString()
                    : String(block.materialLastPublishedAt)}
                </div>
              )}
              {block.materialMetaobjectGid && (
                <div className="text-xs text-gray-400 font-mono break-all">{block.materialMetaobjectGid}</div>
              )}
              {block.materialSyncError && (
                <div className="mt-1 flex items-start gap-1.5 text-xs text-rose-700">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{block.materialSyncError}</span>
                </div>
              )}
            </div>

            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.shouldPublishAsMaterial}
                onChange={(e) => set('shouldPublishAsMaterial', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="font-medium">Publish as material metaobject</span>
                <span className="block text-xs text-gray-500">Trigger fires on save; daily reconciler keeps it fresh.</span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={block.materialCategory || ''}
                  onChange={(e) => set('materialCategory', (e.target.value || undefined) as ShopifyBlock['materialCategory'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— select —</option>
                  {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
                <input
                  value={block.materialHandle || ''}
                  onChange={(e) => set('materialHandle', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder={(item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin country *</label>
                <input
                  value={block.originCountry || ''}
                  onChange={(e) => set('originCountry', e.target.value)}
                  placeholder="Uganda"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin region</label>
                <input
                  value={block.originRegion || ''}
                  onChange={(e) => set('originRegion', e.target.value)}
                  placeholder="Lake Albert"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                value={block.supplier || ''}
                onChange={(e) => set('supplier', e.target.value)}
                placeholder={item.preferredSupplierName ? `defaults to ${item.preferredSupplierName}` : 'optional'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={!!block.isLocal}
                  onChange={(e) => set('isLocal', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-2">Locally sourced</span>
              </label>
              <label className="inline-flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={!!block.isSustainable}
                  onChange={(e) => set('isSustainable', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-2">Sustainable</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cert image URL</label>
              <input
                type="url"
                value={block.certificationImageUrl || ''}
                onChange={(e) => set('certificationImageUrl', e.target.value)}
                placeholder="https://firebasestorage.googleapis.com/… (e.g. FSC for timber)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Material description *</label>
                <button
                  type="button"
                  onClick={handleDraftMaterial}
                  disabled={drafting !== null}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded disabled:opacity-50"
                  title="Draft from category, origin country, supplier, sustainability flags"
                >
                  {drafting === 'material' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Draft with AI
                </button>
              </div>
              <textarea
                rows={3}
                value={block.materialDescription || ''}
                onChange={(e) => set('materialDescription', e.target.value)}
                placeholder="Hand-mixed lime sourced from Lake Albert..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {block.materialMetaobjectGid && (
              <button
                type="button"
                onClick={handleUnpublishMaterial}
                disabled={busy}
                className="px-3 py-2 text-sm font-medium text-rose-700 bg-white border border-rose-300 rounded-lg hover:bg-rose-50 disabled:opacity-50"
              >
                Unpublish material
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyMetafields}
              disabled={busy || !productHasShopifyLink || !block.shouldPublishAsProduct}
              title={!productHasShopifyLink ? 'No Shopify product linked yet' : (!block.shouldPublishAsProduct ? 'Enable "Publish dawin.* metafields" first' : '')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Apply metafields
            </button>
            <button
              type="button"
              onClick={handlePublishMaterial}
              disabled={busy || !block.shouldPublishAsMaterial}
              title={!block.shouldPublishAsMaterial ? 'Enable "Publish as material metaobject" first' : ''}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Publish material
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
