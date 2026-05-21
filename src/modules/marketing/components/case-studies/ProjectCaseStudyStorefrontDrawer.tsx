/**
 * ProjectCaseStudyStorefrontDrawer
 *
 * Edits a project case study's `storefront` block (the Shopify metaobject
 * payload for `project`). Mirrors FinishStorefrontDrawer in structure but
 * carries the full project-spec field set per
 * docs/integrations/metaobjects/project.json.
 *
 * Surfaces:
 *  - Every storefront-block field grouped by purpose
 *  - Live sync status (badge + GID + last-published timestamp + error)
 *  - Save → updates Firestore (sync trigger fires automatically)
 *  - Republish now → invokes `publishProjectMetaobject` callable with force
 *  - Unpublish → flips `shouldPublishToShopify=false`; trigger sets DRAFT on Shopify
 *  - External link to the live storefront page when synced
 */

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { X, Save, Loader2, ExternalLink, RefreshCw, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { functions } from '@/shared/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { updateCaseStudy } from '../../services/projectCaseStudyService';
import { draftStorefrontContent, applyDottedDrafts } from '@/shared/services/ai/draftStorefront';
import {
  PROJECT_STOREFRONT_SECTORS,
  type ProjectCaseStudy,
  type ProjectStorefrontBlock,
  type ProjectStorefrontSector,
  type ProjectStorefrontBudgetBand,
  type ProjectStorefrontCommissionedBy,
  type ShopifyMetaobjectSyncStatus,
} from '../../types/project-case-study.types';

const STOREFRONT_BASE_URL = 'https://dawinfinishes.com';

const SYNC_BADGE: Record<ShopifyMetaobjectSyncStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

const SCOPE_OPTIONS = ['design', 'fitout', 'furniture', 'finishes', 'lighting', 'styling'];

interface ProjectCaseStudyStorefrontDrawerProps {
  caseStudy: ProjectCaseStudy;
  onClose: () => void;
}

function defaultBlock(cs: ProjectCaseStudy): ProjectStorefrontBlock {
  return {
    sector: 'Residential',
    locationCity: cs.hero?.location || '',
    locationCountry: 'UG',
    yearCompleted: cs.hero?.year || new Date().getFullYear(),
    areaSqm: 0,
    scope: [],
    storefrontPublished: true,
    shouldPublishToShopify: false,
  } as ProjectStorefrontBlock;
}

function csv(ids: string[] | undefined): string {
  return (ids || []).join(', ');
}
function parseCsv(s: string): string[] {
  return s
    .split(/[,\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function ProjectCaseStudyStorefrontDrawer({
  caseStudy,
  onClose,
}: ProjectCaseStudyStorefrontDrawerProps) {
  const { user } = useAuth();
  const existing = caseStudy.storefront;
  const [block, setBlock] = useState<ProjectStorefrontBlock>(existing || defaultBlock(caseStudy));
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /**
   * Ask Claude to draft the case-study prose fields. The model gets:
   *   - the case study record (hero / linked refs / handle / category)
   *   - the linked DesignProject (already pulled via the form's "Pull from
   *     project" button — so client/location/year are facts, not guesses)
   *   - summaries of any linked finishes + materials
   * It writes back to the case study's narrative / hero.summary / CTA, NOT
   * directly to Firestore. The user reviews + edits + clicks Save.
   */
  async function handleDraftWithAI() {
    setError(null);
    setDraftNote(null);
    setDrafting(true);
    try {
      const result = await draftStorefrontContent({
        entityType: 'project',
        entityId: caseStudy.id,
        sections: [
          'hero.summary',
          'narrative.heading',
          'narrative.body',
          'narrative.asideHeading',
          'narrative.asideContent',
          'cta.headline',
          'cta.body',
        ],
      });
      const written = Object.entries(result.drafts).filter(([, v]) => Boolean(v)).map(([k]) => k);
      if (written.length === 0) {
        setError('AI returned no drafts. Make sure the case study has a linked DesignProject + at least one finish/material reference.');
        return;
      }
      // Apply drafts to the case study record on the server (preserves dotted-key nesting).
      if (!user?.uid) throw new Error('not signed in');
      // Merge: load the canonical fields off `caseStudy` (in-memory copy), apply drafts, save.
      const baseDoc = {
        hero: caseStudy.hero,
        narrative: caseStudy.narrative,
        cta: caseStudy.cta,
      };
      const merged = applyDottedDrafts(baseDoc, result.drafts);
      await updateCaseStudy(
        caseStudy.id,
        {
          hero: merged.hero as typeof caseStudy.hero,
          narrative: merged.narrative as typeof caseStudy.narrative,
          cta: merged.cta as typeof caseStudy.cta,
        },
        user.uid
      );
      setDraftNote(`Drafted ${written.length} section${written.length > 1 ? 's' : ''}: ${written.join(', ')}. Refresh the case study form to review.`);
    } catch (e) {
      setError((e as Error).message || 'AI draft failed');
    } finally {
      setDrafting(false);
    }
  }

  // CSV-style raw values so users can type commas without each char being
  // a state update; commit on blur.
  const [finishesIdsRaw, setFinishesIdsRaw] = useState(csv(existing?.finishesUsedIds));
  const [materialsIdsRaw, setMaterialsIdsRaw] = useState(csv(existing?.materialsUsedIds));
  const [pressIdsRaw, setPressIdsRaw] = useState(csv(existing?.pressMentionIds));
  const [productsIdsRaw, setProductsIdsRaw] = useState(csv(existing?.productsUsedShopifyIds));

  useEffect(() => {
    setBlock(existing || defaultBlock(caseStudy));
    setDirty(false);
    setError(null);
    setFinishesIdsRaw(csv(existing?.finishesUsedIds));
    setMaterialsIdsRaw(csv(existing?.materialsUsedIds));
    setPressIdsRaw(csv(existing?.pressMentionIds));
    setProductsIdsRaw(csv(existing?.productsUsedShopifyIds));
  }, [caseStudy.id]);

  function set<K extends keyof ProjectStorefrontBlock>(key: K, value: ProjectStorefrontBlock[K]) {
    setBlock((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function toggleScope(s: string) {
    setBlock((prev) => {
      const has = prev.scope.includes(s);
      return { ...prev, scope: has ? prev.scope.filter((x) => x !== s) : [...prev.scope, s] };
    });
    setDirty(true);
  }

  const livePageUrl = useMemo(() => {
    if (!caseStudy.handle) return null;
    return `${STOREFRONT_BASE_URL}/projects/${caseStudy.handle}`;
  }, [caseStudy.handle]);

  function commitCsv() {
    setBlock((prev) => ({
      ...prev,
      finishesUsedIds: parseCsv(finishesIdsRaw),
      materialsUsedIds: parseCsv(materialsIdsRaw),
      pressMentionIds: parseCsv(pressIdsRaw),
      productsUsedShopifyIds: parseCsv(productsIdsRaw),
    }));
    setDirty(true);
  }

  async function handleSave() {
    if (!user?.uid) return;
    setError(null);
    if (!caseStudy.handle) return setError('Case study handle is required — set it on the main form first.');
    if (!block.locationCity) return setError('Location city is required.');
    if (!block.locationCountry) return setError('Location country (ISO-2) is required.');
    if (!block.yearCompleted) return setError('Year completed is required.');
    if (!block.areaSqm) return setError('Area (m²) is required.');
    if (block.scope.length === 0) return setError('Pick at least one scope item.');
    setSaving(true);
    try {
      const payload: ProjectStorefrontBlock = {
        ...block,
        finishesUsedIds: parseCsv(finishesIdsRaw),
        materialsUsedIds: parseCsv(materialsIdsRaw),
        pressMentionIds: parseCsv(pressIdsRaw),
        productsUsedShopifyIds: parseCsv(productsIdsRaw),
      };
      await updateCaseStudy(caseStudy.id, { storefront: payload }, user.uid);
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
      const callable = httpsCallable(functions, 'publishProjectMetaobject');
      const result = await callable({ caseStudyId: caseStudy.id, force: true });
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
    if (!confirm('Unpublish this project from dawinfinishes.com? The page will return 404 within minutes.')) return;
    setError(null);
    setRepublishing(true);
    try {
      const next = { ...block, shouldPublishToShopify: false };
      await updateCaseStudy(caseStudy.id, { storefront: next }, user.uid);
      setBlock(next);
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
            <h2 className="text-lg font-semibold">Storefront · {caseStudy.hero?.title || caseStudy.handle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              dawinfinishes.com /projects/<strong>{caseStudy.handle || '(no handle)'}</strong>
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

          {draftNote && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{draftNote}</span>
            </div>
          )}

          {/* AI draft callout */}
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-purple-900">
                  <Sparkles className="w-4 h-4" />
                  Draft narrative + CTA with AI
                </div>
                <p className="text-xs text-purple-700 mt-0.5">
                  Pulls the linked DesignProject + linked finishes/materials, then writes hero.summary,
                  narrative.heading/body/aside, and cta.headline/body. The case-study form is updated —
                  refresh to review and edit.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDraftWithAI}
                disabled={drafting || !caseStudy.linkedProjectId}
                title={!caseStudy.linkedProjectId ? 'Set linkedProjectId on the case study form first' : ''}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
              >
                {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Draft
              </button>
            </div>
          </div>

          {/* Sector + sub-sector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sector *</label>
              <select
                value={block.sector}
                onChange={(e) => set('sector', e.target.value as ProjectStorefrontSector)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                {PROJECT_STOREFRONT_SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub-sector</label>
              <input
                value={block.subSector || ''}
                onChange={(e) => set('subSector', e.target.value)}
                placeholder="Hotel lounge"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Location + dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Location city *</label>
              <input
                value={block.locationCity}
                onChange={(e) => set('locationCity', e.target.value)}
                placeholder="Kampala"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
              <input
                value={block.locationCountry}
                onChange={(e) => set('locationCountry', e.target.value.toUpperCase().slice(0, 2))}
                placeholder="UG"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
              <input
                type="number"
                value={block.yearCompleted ?? ''}
                onChange={(e) => set('yearCompleted', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month (1–12)</label>
              <input
                type="number" min={1} max={12}
                value={block.monthCompleted ?? ''}
                onChange={(e) => set('monthCompleted', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area (m²) *</label>
              <input
                type="number"
                value={block.areaSqm ?? ''}
                onChange={(e) => set('areaSqm', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scope *</label>
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((opt) => {
                const on = block.scope.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleScope(opt)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      on ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team + budget */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team lead</label>
              <input
                value={block.teamLead || ''}
                onChange={(e) => set('teamLead', e.target.value)}
                placeholder="M. Kalu"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team size</label>
              <input
                type="number" min={1}
                value={block.teamSize ?? ''}
                onChange={(e) => set('teamSize', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (weeks)</label>
              <input
                type="number" min={1}
                value={block.durationWeeks ?? ''}
                onChange={(e) => set('durationWeeks', Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget band</label>
              <select
                value={block.budgetBand || ''}
                onChange={(e) => set('budgetBand', (e.target.value || undefined) as ProjectStorefrontBudgetBand)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                <option value="">—</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commissioned by</label>
              <select
                value={block.commissionedBy || ''}
                onChange={(e) => set('commissionedBy', (e.target.value || undefined) as ProjectStorefrontCommissionedBy)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                <option value="">—</option>
                <option value="client">client</option>
                <option value="architect">architect</option>
                <option value="studio">studio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner architect</label>
              <input
                value={block.partnerArchitect || ''}
                onChange={(e) => set('partnerArchitect', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Linked refs */}
          <div className="border-t pt-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Linked references</div>
            <p className="text-xs text-gray-500 mb-3">Comma-separated ZeusOS doc ids. Publisher resolves to Shopify GIDs.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finishes used (finishLibrary ids)</label>
                <input
                  value={finishesIdsRaw}
                  onChange={(e) => setFinishesIdsRaw(e.target.value)}
                  onBlur={commitCsv}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materials used (inventoryItems ids)</label>
                <input
                  value={materialsIdsRaw}
                  onChange={(e) => setMaterialsIdsRaw(e.target.value)}
                  onBlur={commitCsv}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Press mentions (pressMentions ids)</label>
                <input
                  value={pressIdsRaw}
                  onChange={(e) => setPressIdsRaw(e.target.value)}
                  onBlur={commitCsv}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shopify products (GIDs)</label>
                <input
                  value={productsIdsRaw}
                  onChange={(e) => setProductsIdsRaw(e.target.value)}
                  onBlur={commitCsv}
                  placeholder="gid://shopify/Product/12345, gid://shopify/Product/67890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Auxiliary images */}
          <div className="border-t pt-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Extra images (Firebase Storage URLs)</div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Before image URL</label>
                <input
                  type="url"
                  value={block.beforeImageUrl || ''}
                  onChange={(e) => set('beforeImageUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">After image URL</label>
                <input
                  type="url"
                  value={block.afterImageUrl || ''}
                  onChange={(e) => set('afterImageUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor plan image URL</label>
                <input
                  type="url"
                  value={block.floorPlanImageUrl || ''}
                  onChange={(e) => set('floorPlanImageUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Flags */}
          <div className="border-t pt-4 space-y-3">
            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.storefrontPublished}
                onChange={(e) => set('storefrontPublished', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
              />
              <span>
                <span className="font-medium">Storefront published</span>
                <span className="block text-xs text-gray-500">
                  Visible on dawinfinishes.com. Overrides the case-study editorial status for the storefront only.
                </span>
              </span>
            </label>
            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.shouldPublishToShopify}
                onChange={(e) => set('shouldPublishToShopify', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
              />
              <span>
                <span className="font-medium">Publish to dawinfinishes.com</span>
                <span className="block text-xs text-gray-500">
                  Publish gate — when on, every save fires the sync to Shopify within ~15s.
                </span>
              </span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort index</label>
              <input
                type="number"
                value={block.sortIndex ?? ''}
                onChange={(e) => set('sortIndex', Number(e.target.value) || undefined)}
                placeholder="Lower = earlier on the projects index"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:opacity-50"
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
