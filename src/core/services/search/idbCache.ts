/**
 * IndexedDB cache for the global search index.
 *
 * Persists per-(subsidiary, type) record snapshots so that subsequent app
 * boots can warm-start the in-memory index in <100ms while Firestore
 * listeners reconcile in the background.
 *
 * Keyed by the composite `${subsidiaryId}:${type}` string. Stored as a flat
 * array for simplicity; the index is small enough (<5MB / subsidiary) that
 * we don't need an indexedDB cursor pattern.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { IndexedRecord } from './types';

const DB_NAME = 'dawinos-search-cache';
const DB_VERSION = 1;
const STORE = 'records';
const META_STORE = 'meta';

interface CacheEntry {
  /** `${subsidiaryId}:${type}` */
  key: string;
  records: IndexedRecord[];
  storedAt: number;
}

interface MetaEntry {
  key: string;
  /** `${subsidiaryId}:${type}` */
  lastSyncedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

function compositeKey(subsidiaryId: string, type: string): string {
  return `${subsidiaryId}:${type}`;
}

/** Persist a type's full record snapshot. Called per-type after each rebuild. */
export async function putRecords(subsidiaryId: string, type: string, records: IndexedRecord[]): Promise<void> {
  try {
    const db = await getDB();
    const entry: CacheEntry = {
      key: compositeKey(subsidiaryId, type),
      records,
      storedAt: Date.now(),
    };
    await db.put(STORE, entry);
    await db.put(META_STORE, { key: entry.key, lastSyncedAt: entry.storedAt } satisfies MetaEntry);
  } catch (err) {
    // IndexedDB failures must NEVER break the live index. Log and continue.
    console.warn('[search/idbCache] putRecords failed', err);
  }
}

/** Load all cached records for a subsidiary on boot. Returns a Map<type, records[]>. */
export async function loadAll(subsidiaryId: string): Promise<Map<string, IndexedRecord[]>> {
  const result = new Map<string, IndexedRecord[]>();
  try {
    const db = await getDB();
    const all = (await db.getAll(STORE)) as CacheEntry[];
    const prefix = `${subsidiaryId}:`;
    for (const entry of all) {
      if (!entry.key.startsWith(prefix)) continue;
      const type = entry.key.slice(prefix.length);
      result.set(type, entry.records);
    }
  } catch (err) {
    console.warn('[search/idbCache] loadAll failed', err);
  }
  return result;
}

/** Delete a subsidiary's cached records (used on signout / explicit reset). */
export async function clearSubsidiary(subsidiaryId: string): Promise<void> {
  try {
    const db = await getDB();
    const all = (await db.getAll(STORE)) as CacheEntry[];
    const prefix = `${subsidiaryId}:`;
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    for (const entry of all) {
      if (entry.key.startsWith(prefix)) {
        await tx.objectStore(STORE).delete(entry.key);
        await tx.objectStore(META_STORE).delete(entry.key);
      }
    }
    await tx.done;
  } catch (err) {
    console.warn('[search/idbCache] clearSubsidiary failed', err);
  }
}

/** Diagnostic — returns last-sync timestamps for every cached type under a subsidiary. */
export async function getLastSyncedAt(subsidiaryId: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const db = await getDB();
    const all = (await db.getAll(META_STORE)) as MetaEntry[];
    const prefix = `${subsidiaryId}:`;
    for (const m of all) {
      if (!m.key.startsWith(prefix)) continue;
      result.set(m.key.slice(prefix.length), m.lastSyncedAt);
    }
  } catch (err) {
    console.warn('[search/idbCache] getLastSyncedAt failed', err);
  }
  return result;
}
