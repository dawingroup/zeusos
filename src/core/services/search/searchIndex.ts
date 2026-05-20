/**
 * SearchIndexManager — singleton owning the in-memory Fuse.js indexes
 * for Global Search V2.
 *
 * Lifecycle:
 *   attachSubsidiary(orgId, subId)
 *     → seed from IndexedDB cache (warm start)
 *     → for each indexable SearchConfig, attach an onSnapshot listener
 *     → on snapshot, normalize docs to IndexedRecord and rebuild the
 *       per-type Fuse index, then persist to IndexedDB.
 *   detach()
 *     → unsubscribe every listener, clear in-memory state. IDB retained.
 *
 * Keystroke path:
 *   search(query, opts)
 *     → query each per-type Fuse index in parallel (synchronous in-memory).
 *     → flatten + rank via combineScore + sortHits
 *     → return top N hits.
 *
 * The manager is a module-level singleton because:
 *   1. Only one global search exists in the app.
 *   2. Listeners must outlive any individual React tree mount (e.g. route
 *      changes) and tie cleanly to subsidiary changes.
 *   3. Tests can call `__resetForTests()` to reset state.
 */

import Fuse from 'fuse.js';
import {
  collection,
  query as fsQuery,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import { SEARCH_CONFIGS, type SearchConfig } from '@/integration/constants/navigation.constants';
import type { RecentItem } from '@/integration/types';
import type {
  AttachKey,
  IndexReadiness,
  IndexedRecord,
  SearchHit,
  SearchOptions,
} from './types';
import { configForType } from './fuseConfigs';
import { combineScore, sortHits } from './ranking';
import { loadAll as idbLoadAll, putRecords as idbPutRecords } from './idbCache';

type ReadyListener = (state: IndexReadiness) => void;

interface PerTypeState {
  config: SearchConfig;
  records: Map<string, IndexedRecord>;
  fuse: Fuse<IndexedRecord>;
  unsubscribe?: Unsubscribe;
  /** True once the initial snapshot resolves (or fails). */
  loaded: boolean;
  /** Set once if the listener was denied by Firestore rules — we stop touching it. */
  denied: boolean;
}

class SearchIndexManager {
  private currentKey: AttachKey | null = null;
  private byType: Map<string, PerTypeState> = new Map();
  private expectedTypes = 0;
  private listeners: Set<ReadyListener> = new Set();
  private permissionDeniedLogged: Set<string> = new Set();
  /**
   * Cached readiness snapshot. useSyncExternalStore requires getSnapshot() to
   * return a referentially-stable value between calls; rebuilding a fresh
   * object every time triggers React's tearing detection (#426). We rebuild
   * only when notify() fires.
   */
  private cachedReadiness: IndexReadiness = {
    ready: false,
    counts: {},
    loaded: new Set<string>(),
    expected: 0,
  };

  // ---------- public API ----------

  isReady(): boolean {
    return this.byType.size > 0 && [...this.byType.values()].every((s) => s.loaded);
  }

  /** Returns a cached, referentially-stable snapshot. Safe for useSyncExternalStore. */
  readiness(): IndexReadiness {
    return this.cachedReadiness;
  }

  private rebuildReadinessSnapshot(): void {
    const counts: Record<string, number> = {};
    const loaded = new Set<string>();
    for (const [t, s] of this.byType) {
      counts[t] = s.records.size;
      if (s.loaded) loaded.add(t);
    }
    this.cachedReadiness = {
      ready: this.isReady(),
      counts,
      loaded,
      expected: this.expectedTypes,
    };
  }

  onReady(cb: ReadyListener): () => void {
    this.listeners.add(cb);
    cb(this.cachedReadiness);
    return () => this.listeners.delete(cb);
  }

  /**
   * Attach listeners for a given (organization, subsidiary). Idempotent — calling
   * with the same key is a no-op. Calling with a different key tears down the
   * previous attach first.
   */
  async attachSubsidiary(organizationId: string, subsidiaryId: string): Promise<void> {
    if (!subsidiaryId) return;
    const key: AttachKey = `${organizationId || ''}:${subsidiaryId}`;
    if (key === this.currentKey) return;

    this.detach();
    this.currentKey = key;

    const eligible = SEARCH_CONFIGS.filter((cfg) => {
      if (cfg.indexable === false) return false;
      if (cfg.subsidiaryIds?.length && !cfg.subsidiaryIds.includes(subsidiaryId)) return false;
      return true;
    });

    this.expectedTypes = eligible.length;

    // Seed from IDB synchronously-ish so the palette has data instantly on warm starts.
    const cached = await idbLoadAll(subsidiaryId);

    for (const cfg of eligible) {
      const fuseOpts = configForType(cfg);
      const records = new Map<string, IndexedRecord>();
      const seedList = cached.get(cfg.type);
      if (seedList) {
        for (const r of seedList) records.set(r.id, r);
      }
      const fuse = new Fuse([...records.values()], fuseOpts);
      this.byType.set(cfg.type, {
        config: cfg,
        records,
        fuse,
        loaded: seedList !== undefined && seedList.length > 0,
        denied: false,
      });
    }
    this.notify();

    // Attach Firestore listeners (one per config). These run for the lifetime
    // of the current attach and stream deltas into the in-memory map + Fuse.
    for (const cfg of eligible) {
      const state = this.byType.get(cfg.type)!;
      const constraints: any[] = [];
      if (cfg.scopeField === 'organizationId' && organizationId) {
        constraints.push(where('organizationId', '==', organizationId));
      } else if (cfg.scopeField === 'subsidiaryId') {
        constraints.push(where('subsidiaryId', '==', subsidiaryId));
      }

      const q = fsQuery(collection(db, cfg.collection), ...constraints);
      try {
        state.unsubscribe = onSnapshot(
          q,
          (snap) => {
            // Apply changes incrementally; rebuild Fuse once per snapshot.
            for (const change of snap.docChanges()) {
              if (change.type === 'removed') {
                state.records.delete(change.doc.id);
              } else {
                state.records.set(change.doc.id, normalizeDoc(cfg, change.doc.id, change.doc.data(), subsidiaryId));
              }
            }
            state.fuse = new Fuse([...state.records.values()], configForType(cfg));
            state.loaded = true;
            // Persist (fire-and-forget). Bound list size to keep IDB writes cheap.
            void idbPutRecords(subsidiaryId, cfg.type, [...state.records.values()].slice(0, 5000));
            this.notify();
          },
          (err: { code?: string }) => {
            const code = err?.code;
            if (code === 'permission-denied') {
              if (!this.permissionDeniedLogged.has(cfg.type)) {
                this.permissionDeniedLogged.add(cfg.type);
                // Normal when global search indexes collections your role cannot read.
                if (import.meta.env.DEV) {
                  console.debug(`[searchIndex] permission denied for ${cfg.collection}; skipping for session.`);
                }
              }
              state.denied = true;
              state.loaded = true;
              this.notify();
              return;
            }
            console.warn(`[searchIndex] listener error for ${cfg.type}:`, err);
            state.loaded = true;
            this.notify();
          },
        );
      } catch (err) {
        console.warn(`[searchIndex] failed to attach listener for ${cfg.type}:`, err);
        state.loaded = true;
      }
    }
  }

  /** Tear down all listeners + clear in-memory state. IDB cache retained. */
  detach(): void {
    for (const state of this.byType.values()) {
      try {
        state.unsubscribe?.();
      } catch {
        /* noop */
      }
    }
    this.byType.clear();
    this.expectedTypes = 0;
    this.currentKey = null;
    this.permissionDeniedLogged.clear();
    this.notify();
  }

  /**
   * Synchronous, in-memory search. Returns ranked hits.
   * Caller is responsible for handling the deep-find mode separately
   * (we don't reach into the legacy Firestore path from here).
   */
  search(query: string, opts: SearchOptions = {}, recentItems: ReadonlyArray<RecentItem> = []): SearchHit[] {
    const text = query.trim();
    if (!text) return [];
    if (this.byType.size === 0) return [];

    const limit = opts.limit ?? 15;
    const types = opts.types?.length ? new Set(opts.types) : null;
    const ctx = { recentItems, query: text };

    const allHits: SearchHit[] = [];
    for (const [t, state] of this.byType) {
      if (types && !types.has(t)) continue;
      if (state.denied) continue;
      const fuseResults = state.fuse.search(text, { limit: 10 });
      for (const r of fuseResults) {
        const hit: SearchHit = {
          record: r.item,
          score: combineScore(r.score, r.item, ctx),
          matches: r.matches as SearchHit['matches'],
        };
        allHits.push(hit);
      }
    }

    return sortHits(allHits).slice(0, limit);
  }

  getRecordById(type: string, id: string): IndexedRecord | undefined {
    return this.byType.get(type)?.records.get(id);
  }

  // ---------- internals ----------

  private notify(): void {
    this.rebuildReadinessSnapshot();
    const state = this.cachedReadiness;
    for (const cb of this.listeners) cb(state);
  }

  /** Test-only — reset module state between tests. */
  __resetForTests(): void {
    this.detach();
    this.listeners.clear();
  }
}

// ---- module-level normalizer ----

function asNumberTimestamp(v: unknown): number | undefined {
  if (!v) return undefined;
  // Firestore Timestamp
  if (typeof v === 'object' && v !== null && 'toMillis' in v && typeof (v as { toMillis: unknown }).toMillis === 'function') {
    try {
      return (v as { toMillis: () => number }).toMillis();
    } catch { /* fall through */ }
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    const s = (v as { seconds?: number }).seconds;
    if (typeof s === 'number') return s * 1000;
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}

function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function normalizeDoc(
  cfg: SearchConfig,
  id: string,
  data: Record<string, unknown>,
  subsidiaryId: string,
): IndexedRecord {
  const title = String(getFieldValue(data, cfg.displayField) ?? id);
  const subtitle = cfg.subtitleField
    ? String(getFieldValue(data, cfg.subtitleField) ?? '') || undefined
    : undefined;

  // For the special case of `employee` (firstName + lastName), prefer a combined display.
  const displayTitle = cfg.type === 'employee'
    ? `${asString(data.firstName)} ${asString(data.lastName)}`.trim() || title
    : title;

  return {
    id,
    type: cfg.type,
    module: cfg.module,
    subsidiaryId,
    path: cfg.urlTemplate.replace('{id}', id),
    icon: cfg.icon,
    cardKind: cfg.cardKind ?? cfg.type,
    title: displayTitle,
    subtitle,
    updatedAt: asNumberTimestamp(data.updatedAt),
    createdAt: asNumberTimestamp(data.createdAt),
    data,
  };
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ---- exported singleton ----
export const searchIndex = new SearchIndexManager();

// Re-export types for consumers
export type { IndexedRecord, SearchHit, IndexReadiness } from './types';

// Test helpers
export const __testing = {
  normalizeDoc,
  asNumberTimestamp,
};
