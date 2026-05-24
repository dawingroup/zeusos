/**
 * ShopifySyncPage
 *
 * Ops dashboard for the ZeusOS → dawinfinishes.com integration.
 * Surfaces sync status per entity type, recent failures, last-reconciliation
 * run, and a re-publish-now action.
 */

import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  collection, getDocs, query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/shared/services/firebase';
import { RefreshCw } from 'lucide-react';

interface EntityCounts {
  total: number;
  synced: number;
  error: number;
  pending: number;
  unpublished: number;
}

const SHOPIFY_ENTITIES: Array<{
  key: string;
  label: string;
  collection: string;
  gateField: string;
  syncStatusField: string;
  publisherCallable: string;
  idField?: string;
}> = [
  { key: 'finish',          label: 'Finishes',          collection: 'finishLibrary',     gateField: 'dawinFinishes.shouldPublishToShopify', syncStatusField: 'dawinFinishes.shopifySyncStatus', publisherCallable: 'publishFinishMetaobject', idField: 'finishId' },
  { key: 'project',         label: 'Projects',          collection: 'projectCaseStudies', gateField: 'storefront.shouldPublishToShopify',   syncStatusField: 'storefront.shopifySyncStatus',   publisherCallable: 'publishProjectMetaobject', idField: 'caseStudyId' },
  { key: 'voice',           label: 'Voices',            collection: 'voices',             gateField: 'shouldPublishToShopify',               syncStatusField: 'shopifySyncStatus',              publisherCallable: 'publishVoiceMetaobject', idField: 'voiceId' },
  { key: 'press_mention',   label: 'Press mentions',    collection: 'pressMentions',      gateField: 'shouldPublishToShopify',               syncStatusField: 'shopifySyncStatus',              publisherCallable: 'publishPressMentionMetaobject', idField: 'id' },
  { key: 'featured_update', label: 'Featured updates',  collection: 'featuredUpdates',    gateField: 'shouldPublishToShopify',               syncStatusField: 'shopifySyncStatus',              publisherCallable: 'publishFeaturedUpdateMetaobject', idField: 'id' },
  { key: 'material',        label: 'Materials',         collection: 'inventoryItems',     gateField: 'shopify.shouldPublishAsMaterial',     syncStatusField: 'shopify.materialSyncStatus',     publisherCallable: 'publishMaterialMetaobject', idField: 'inventoryItemId' },
];

type EntityCountsMap = Record<string, EntityCounts>;

async function countSyncStatuses(collectionName: string, gateField: string, statusField: string): Promise<EntityCounts> {
  // Count docs gated by `gateField`==true. We tally by status field client-side
  // since Firestore can't aggregate arbitrary nested fields server-side without
  // composite indexes.
  const snap = await getDocs(query(collection(db, collectionName), where(gateField, '==', true)));
  const counts: EntityCounts = { total: 0, synced: 0, error: 0, pending: 0, unpublished: 0 };
  snap.forEach((d) => {
    counts.total++;
    const value = statusField.split('.').reduce((a: any, k) => (a ? a[k] : undefined), d.data());
    if (value === 'synced') counts.synced++;
    else if (value === 'error') counts.error++;
    else if (value === 'unpublished') counts.unpublished++;
    else counts.pending++;
  });
  return counts;
}

interface FailureRow {
  id: string;
  entity: string;
  docId: string;
  error: string;
  createdAt?: Timestamp;
}

export default function ShopifySyncPage() {
  const [counts, setCounts] = useState<EntityCountsMap>({});
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const all: EntityCountsMap = {};
      for (const e of SHOPIFY_ENTITIES) {
        try {
          all[e.key] = await countSyncStatuses(e.collection, e.gateField, e.syncStatusField);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`failed to count ${e.key}`, err);
        }
      }
      setCounts(all);

      const fSnap = await getDocs(
        query(collection(db, 'shopifySyncFailures'), orderBy('createdAt', 'desc'), limit(20))
      );
      setFailures(fSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FailureRow, 'id'>) })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <>
      <Helmet>
        <title>Shopify Sync | ZeusOS</title>
      </Helmet>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shopify Sync</h1>
            <p className="text-muted-foreground">
              ZeusOS → dawinfinishes.com integration status. Each entity row shows how many records are
              gated for publishing and their current sync state.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 text-left font-medium">Entity</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Synced</th>
              <th className="px-2 py-2 text-right font-medium">Pending</th>
              <th className="px-2 py-2 text-right font-medium">Errors</th>
              <th className="px-2 py-2 text-right font-medium">Unpublished</th>
            </tr>
          </thead>
          <tbody>
            {SHOPIFY_ENTITIES.map((e) => {
              const c = counts[e.key];
              return (
                <tr key={e.key} className="border-b">
                  <td className="px-2 py-2 font-medium">{e.label}</td>
                  <td className="px-2 py-2 text-right">{c?.total ?? '—'}</td>
                  <td className="px-2 py-2 text-right text-[var(--rag-green)]">{c?.synced ?? '—'}</td>
                  <td className="px-2 py-2 text-right text-[var(--rag-amber)]">{c?.pending ?? '—'}</td>
                  <td className="px-2 py-2 text-right text-[var(--rag-red)]">{c?.error ?? '—'}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{c?.unpublished ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div>
          <h2 className="text-lg font-semibold mb-2">Recent failures (last 20)</h2>
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failures recorded.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">When</th>
                  <th className="px-2 py-2 text-left font-medium">Entity</th>
                  <th className="px-2 py-2 text-left font-medium">Doc ID</th>
                  <th className="px-2 py-2 text-left font-medium">Error</th>
                  <th className="px-2 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => {
                  const cfg = SHOPIFY_ENTITIES.find((e) => e.key === f.entity);
                  return (
                    <tr key={f.id} className="border-b align-top">
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {f.createdAt?.toDate?.().toLocaleString() || '—'}
                      </td>
                      <td className="px-2 py-2">{f.entity}</td>
                      <td className="px-2 py-2 font-mono text-xs">{f.docId}</td>
                      <td className="px-2 py-2 text-xs text-[var(--rag-red)]">{f.error?.slice(0, 200)}</td>
                      <td className="px-2 py-2">
                        {cfg && (
                          <button
                            onClick={async () => {
                              setBusyKey(`${f.id}`);
                              try {
                                const call = httpsCallable(functions, cfg.publisherCallable);
                                await call({ [cfg.idField || 'id']: f.docId, force: true });
                                await refresh();
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                            disabled={busyKey === f.id}
                            className="rounded border px-2 py-0.5 text-xs hover:bg-[var(--bg-sunken)] disabled:opacity-50"
                          >
                            {busyKey === f.id ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-md border bg-[var(--bg-sunken)] p-3 text-xs">
          <strong>Daily reconciler:</strong> runs 23:00 UTC (02:00 EAT) via Cloud Scheduler. To run on
          demand, use the Firebase console or <code>gcloud scheduler jobs run firebase-schedule-shopifyDailyReconcile</code>.
        </div>
      </div>
    </>
  );
}
