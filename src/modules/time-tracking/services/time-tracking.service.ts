/**
 * Time tracking — Phase 5.D MVP.
 *
 * Cross-IWO "my time" query. The per-IWO time-entry subscription lives
 * in `src/modules/delivery/services/firestore.ts` (where the burn meter
 * + IWO workspace use it). This module adds a collection-group query
 * keyed on `userId` so a staff member can see every time entry they've
 * logged across the whole organisation in one fetch.
 *
 * Underpinning:
 *   • Firestore composite index `time_entries (userId ASC, entryDate
 *     DESC)` already exists at the collection-group scope
 *     (firestore.indexes.json).
 *   • Firestore rules on the subcollection require parent-org OR home-
 *     subsidiary on the parent IWO, which means staff querying their
 *     own entries see only those on IWOs in their home brand (a
 *     reasonable default — staff don't deliver across brands).
 *     Parent-org admins (e.g. Onzima) see everything.
 *
 * The page (`MyTimeThisWeekPage`) treats the query as the source of
 * truth for the weekly view; it doesn't keep a local cache.
 */

import {
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { TimeEntry } from '@/modules/delivery';

/**
 * Subscribe to a user's time entries within a date window.
 *
 * Returns the unsubscribe function; the caller is responsible for
 * tearing it down on unmount.
 *
 * Date semantics: `from` is inclusive, `to` is exclusive (the page
 * computes them from the local Monday → next Monday so daylight-saving
 * doesn't shift a day off the window).
 */
export function subscribeMyTimeEntries(
  userId: string,
  from: Date,
  to: Date,
  cb: (entries: TimeEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'time_entries'),
    where('userId', '==', userId),
    where('entryDate', '>=', from.toISOString()),
    where('entryDate', '<', to.toISOString()),
    orderBy('entryDate', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<TimeEntry, 'id'>),
    }))),
    (err) => onError?.(err),
  );
}

/**
 * Subscribe to EVERY time entry in a date window — the team view.
 *
 * No `userId` filter: this returns the whole org's entries for the
 * window. The `time_entries` read rule only lets parent-org principals
 * see across brands (subsidiary principals are scoped to IWOs in their
 * own brand). Because a collection-group query is rejected wholesale if
 * ANY returned doc fails the rule, this query is **parent-org-only** in
 * practice — the page guards `/time/team` with `ParentOrgGuard`, and a
 * subsidiary principal who reached it anyway would get a
 * permission-denied error surfaced in the alert region rather than a
 * partial result.
 *
 * Index: the single-field `entryDate` range query uses Firestore's
 * auto-created collection-group single-field index (no fieldOverride
 * exemption exists for `time_entries.entryDate`), so no composite index
 * needs to be added.
 *
 * A future brand-scoped team view would either denormalise
 * `subsidiaryOrgId` onto the time-entry doc (then query
 * `where subsidiaryOrgId == … && entryDate in window`) or fan out one
 * `subscribeMyTimeEntries` per resolved team-member uid. Both are
 * out of scope for this MVP.
 */
export function subscribeTeamTimeEntries(
  from: Date,
  to: Date,
  cb: (entries: TimeEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'time_entries'),
    where('entryDate', '>=', from.toISOString()),
    where('entryDate', '<', to.toISOString()),
    orderBy('entryDate', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<TimeEntry, 'id'>),
    }))),
    (err) => onError?.(err),
  );
}

// ──────────────────────────────────────────────────────────────────
// Date math — extracted for testability.
// ──────────────────────────────────────────────────────────────────

/**
 * Week boundaries (Monday 00:00 → next Monday 00:00 in the local zone).
 * The `weekOffset` argument lets the page navigate forward/back without
 * the caller doing the math: `0` = this week, `-1` = last week, etc.
 */
export function weekRange(now: Date, weekOffset = 0): { from: Date; to: Date } {
  const d = new Date(now);
  // Local-time Monday: JS day-of-week is 0=Sun…6=Sat; we want 0=Mon…6=Sun.
  const dow = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dow + weekOffset * 7);
  const from = new Date(d);
  const to = new Date(d);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

/**
 * Sum minutes across an entry list — handy for the page header.
 */
export function totalMinutes(entries: readonly TimeEntry[]): number {
  return entries.reduce((s, e) => s + (e.minutes || 0), 0);
}

/**
 * Group entries by `iwoId`, preserving the per-IWO sum.
 */
export interface IwoBucket {
  iwoId: string;
  totalMinutes: number;
  entries: TimeEntry[];
}

export function groupByIwo(entries: readonly TimeEntry[]): IwoBucket[] {
  const buckets = new Map<string, IwoBucket>();
  for (const e of entries) {
    const existing = buckets.get(e.iwoId);
    if (existing) {
      existing.totalMinutes += e.minutes || 0;
      existing.entries.push(e);
    } else {
      buckets.set(e.iwoId, { iwoId: e.iwoId, totalMinutes: e.minutes || 0, entries: [e] });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Group entries by `userId` — the team view's primary axis. Each
 * member bucket keeps a nested per-IWO breakdown so the page can show
 * "who, doing what" at a glance.
 */
export interface UserBucket {
  userId: string;
  totalMinutes: number;
  /** Sum of `costMinor` across the member's entries (Phase 5.D depth).
   *  Internal cost — only surfaced on the parent-org team view. */
  totalCostMinor: number;
  iwoCount: number;
  entries: TimeEntry[];
}

export function groupByUser(entries: readonly TimeEntry[]): UserBucket[] {
  const buckets = new Map<string, UserBucket>();
  for (const e of entries) {
    const existing = buckets.get(e.userId);
    if (existing) {
      existing.totalMinutes += e.minutes || 0;
      existing.totalCostMinor += e.costMinor || 0;
      existing.entries.push(e);
    } else {
      buckets.set(e.userId, {
        userId: e.userId,
        totalMinutes: e.minutes || 0,
        totalCostMinor: e.costMinor || 0,
        iwoCount: 0,
        entries: [e],
      });
    }
  }
  // Compute distinct IWO count per member after collection.
  for (const b of buckets.values()) {
    b.iwoCount = new Set(b.entries.map((e) => e.iwoId)).size;
  }
  return Array.from(buckets.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * `entryDate` can be a Firestore Timestamp or an ISO string (the type
 * union allows both). This returns the calendar-day key — useful for
 * per-day rollups in the page header.
 */
export function dayKey(entryDate: TimeEntry['entryDate']): string {
  if (typeof entryDate === 'string') return entryDate.slice(0, 10);
  const ts = entryDate as Timestamp;
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toISOString().slice(0, 10);
  }
  return '—';
}

/**
 * Minutes → "Xh YYm" (rounded down). `0` and negative numbers render
 * "0h 0m" to keep the column width steady in the page table.
 */
export function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '0h 0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

/**
 * Minor units → `CUR 1,234.56`. Time entries don't all share a
 * currency in principle, but a single subsidiary's IWOs do, so the
 * team view passes the dominant currency for display. Negative / NaN
 * clamp to 0 for a steady column.
 */
export function formatMinor(amountMinor: number, currency = 'USD'): string {
  const safe = Number.isFinite(amountMinor) && amountMinor > 0 ? amountMinor : 0;
  return `${currency} ${(safe / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
