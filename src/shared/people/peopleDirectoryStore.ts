/**
 * People directory — ONE session-long map from any person key to a display
 * name, shared by every surface that shows who did something.
 *
 * WHY THIS EXISTS
 * ---------------
 * `createdBy`, `assignedTo`, `approvedBy`, `userId` … carry EITHER an
 * employee doc id OR a Firebase Auth uid depending on which writer stamped
 * them. Without a shared resolver every page either rolled its own map or
 * printed the id (Time tracking shipped its own `resolveUserNames`, one
 * `getDoc` per uid). This store subscribes once per session and answers
 * synchronously from memory.
 *
 * WHERE THE NAMES COME FROM
 * -------------------------
 * - `users/{uid}` — the profile doc every signed-in staff member has
 *   (`firestore.rules`: readable by any authenticated user).
 * - `employees/{id}` — the HR record, which links to the auth uid through
 *   `systemAccess.userId`. Only DISPLAY fields are kept in memory; salary and
 *   identity numbers never leave the snapshot callback.
 *
 * If one source is refused for this person (rules tightened later), names
 * still resolve from the other; it is only an error when nothing answers.
 *
 * DESIGN
 * ------
 * - Lazily started on the first subscriber, never torn down: one `onSnapshot`
 *   per source. After the initial read only deltas arrive.
 * - NO status / isDeleted filter on the query. A time entry posted last year
 *   by someone who has since left must still show their name. Deleted or
 *   terminated records only rank LOWER on a key collision.
 * - Keys: employee doc id, `systemAccess.userId`, email; users doc id, `uid`,
 *   email.
 * - Plain external store (useSyncExternalStore), not React Query, so no
 *   QueryClient is needed in the tests of its ~N consumer surfaces.
 */
import { collection, onSnapshot, type DocumentData, type QuerySnapshot } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';

export interface PersonEntry {
  /** "First Last" | displayName | the local part of the email. Never an id. */
  name: string;
  /** employees/{id} */
  employeeId?: string;
  /** Firebase Auth uid (employees.systemAccess.userId | users.uid | users doc id) */
  uid?: string;
  email?: string;
  photoUrl?: string;
  jobTitle?: string;
  departmentId?: string;
  subsidiaryId?: string;
  source: 'employee' | 'user' | 'system';
  isDeleted?: boolean;
}

export type PeopleDirectoryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PeopleDirectorySnapshot {
  byKey: ReadonlyMap<string, PersonEntry>;
  status: PeopleDirectoryStatus;
  error?: Error;
}

/**
 * Automated writers stamp a marker instead of a person. Naming them keeps a
 * timeline from reading "Unknown user" for every system action.
 */
const SYSTEM_ACTORS: ReadonlyArray<[RegExp, string]> = [
  [/^system$/i, 'System'],
  [/^bank-import[:/]/i, 'Bank import'],
  [/^(agent|ag)[:/-]/i, 'ZeusOS agent'],
  [/^za-\d/i, 'ZeusOS agent'],
  [/^(zeusos|mcp)[:/-]/i, 'ZeusOS'],
];

const EMPTY: PeopleDirectorySnapshot = { byKey: new Map(), status: 'idle' };

type Source = 'employees' | 'users';
const SOURCES: Source[] = ['employees', 'users'];

let snapshot: PeopleDirectorySnapshot = EMPTY;
let listeners = new Set<() => void>();
let started = false;
let unsubscribers: Array<() => void> = [];
let employeeEntries: PersonEntry[] = [];
let userEntries: PersonEntry[] = [];
let settled = new Set<Source>();
let failed = new Set<Source>();
/** The refusal behind an `error` status, kept so a later success elsewhere does not erase it. */
let lastRefusal: Error | undefined;
let primed = false;

function emit() {
  for (const l of listeners) l();
}

/** A live employee over a profile over a deleted / terminated employee. */
function rank(e: PersonEntry): number {
  if (e.source === 'employee') return e.isDeleted ? 0 : 2;
  return 1;
}

function normaliseKey(key: string): string {
  return key.includes('@') ? key.trim().toLowerCase() : key.trim();
}

/** Higher-ranked entry wins a key; ties keep the first writer. */
function claim(map: Map<string, PersonEntry>, key: string | undefined | null, entry: PersonEntry) {
  if (!key) return;
  const k = normaliseKey(key);
  const existing = map.get(k);
  if (!existing || rank(entry) > rank(existing)) map.set(k, entry);
}

function rebuild(status: PeopleDirectoryStatus, error?: Error) {
  const byKey = new Map<string, PersonEntry>();
  for (const e of [...employeeEntries, ...userEntries]) {
    claim(byKey, e.employeeId, e);
    claim(byKey, e.uid, e);
    claim(byKey, e.email, e);
  }
  snapshot = { byKey, status, error };
  emit();
}

/** `loading` until every source has answered or been refused; `error` only when all refused. */
function settledStatus(): PeopleDirectoryStatus {
  if (!SOURCES.every((s) => settled.has(s))) return 'loading';
  return SOURCES.every((s) => failed.has(s)) ? 'error' : 'ready';
}

function emailLocalPart(email: unknown): string | undefined {
  if (typeof email !== 'string' || !email.includes('@')) return undefined;
  return email.split('@')[0];
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

const GONE_STATUSES = new Set(['terminated', 'archived', 'deleted', 'inactive']);

function employeeToEntry(id: string, d: DocumentData): PersonEntry | null {
  const email = str(d.email) ?? str(d.workEmail) ?? str(d.systemAccess?.email);
  const name =
    str(d.fullName) ??
    str([str(d.firstName), str(d.lastName)].filter(Boolean).join(' ')) ??
    str(d.preferredName) ??
    str(d.displayName) ??
    emailLocalPart(email);
  if (!name) return null;
  const status = str(d.status)?.toLowerCase();
  return {
    name,
    employeeId: id,
    uid: str(d.systemAccess?.userId) ?? str(d.userId),
    email,
    photoUrl: str(d.photoUrl) ?? str(d.photoURL),
    jobTitle: str(d.jobTitle) ?? str(d.position),
    departmentId: str(d.departmentId),
    subsidiaryId: str(d.subsidiaryId),
    source: 'employee',
    isDeleted: d.isDeleted === true || (status !== undefined && GONE_STATUSES.has(status)),
  };
}

function userToEntry(id: string, d: DocumentData): PersonEntry | null {
  const email = str(d.email);
  const name = str(d.displayName) ?? str(d.name) ?? str(d.fullName) ?? emailLocalPart(email);
  if (!name) return null;
  // The users doc id is normally the uid; when a doc carries a different
  // `uid` field, key BOTH so a stale doc id still resolves.
  return {
    name,
    uid: str(d.uid) ?? id,
    email,
    photoUrl: str(d.photoURL) ?? str(d.photoUrl),
    subsidiaryId: str(d.homeSubsidiaryId) ?? str(d.organizationId),
    source: 'user',
  };
}

function ingest(snap: QuerySnapshot<DocumentData>, toEntry: (id: string, d: DocumentData) => PersonEntry | null): PersonEntry[] {
  const out: PersonEntry[] = [];
  snap.forEach((docSnap) => {
    const entry = toEntry(docSnap.id, docSnap.data() ?? {});
    if (entry) out.push(entry);
  });
  return out;
}

function start() {
  if (started) return;
  started = true;
  snapshot = { byKey: snapshot.byKey, status: 'loading' };
  emit();

  const subscribe = (
    source: Source,
    makeRef: () => ReturnType<typeof collection>,
    onData: (snap: QuerySnapshot<DocumentData>) => void,
  ) => {
    const refused = (err: unknown) => {
      failed.add(source);
      settled.add(source);
      lastRefusal = err as Error;
      const status = settledStatus();
      console.warn(
        status === 'error'
          ? `[peopleDirectory] ${source} could not be read and nothing covers for it; names will not resolve.`
          : `[peopleDirectory] ${source} could not be read; names resolve from the other source.`,
        err,
      );
      rebuild(status, status === 'error' ? lastRefusal : undefined);
    };
    try {
      // Building the ref inside the try: an unavailable db (a partially
      // mocked test, a misconfigured bundle) is a refused source, not a crash.
      const unsub = onSnapshot(
        makeRef(),
        (snap) => {
          onData(snap);
          failed.delete(source);
          settled.add(source);
          const status = settledStatus();
          rebuild(status, status === 'error' ? lastRefusal : undefined);
        },
        refused,
      );
      // Under a unit-test firestore mock onSnapshot may be a bare vi.fn() that
      // returns undefined and never calls back; the store then stays
      // `loading`, which is the correct observable state.
      if (typeof unsub === 'function') unsubscribers.push(unsub);
    } catch (err) {
      refused(err);
    }
  };

  subscribe('employees', () => collection(db, 'employees'), (snap) => {
    employeeEntries = ingest(snap, employeeToEntry);
  });
  subscribe('users', () => collection(db, 'users'), (snap) => {
    userEntries = ingest(snap, userToEntry);
  });
}

/** Subscribe to changes. Starts the Firestore listeners on the first call. */
export function subscribePeopleDirectory(listener: () => void): () => void {
  listeners.add(listener);
  if (!primed) start();
  return () => {
    listeners.delete(listener);
  };
}

/** Stable reference until the directory changes — safe for useSyncExternalStore. */
export function getPeopleDirectorySnapshot(): PeopleDirectorySnapshot {
  return snapshot;
}

export function lookupPerson(id: string | null | undefined): PersonEntry | undefined {
  if (!id) return undefined;
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  for (const [re, name] of SYSTEM_ACTORS) {
    if (re.test(trimmed)) return { name, source: 'system', uid: trimmed };
  }
  return snapshot.byKey.get(normaliseKey(trimmed));
}

/**
 * Everyone pickable, once each, sorted by name. Deleted / terminated records
 * are excluded — they still RESOLVE for historic references, but nobody
 * should be assigned to one.
 */
export function listPeople(): PersonEntry[] {
  const seen = new Set<PersonEntry>();
  for (const entry of snapshot.byKey.values()) {
    if (entry.isDeleted) continue;
    seen.add(entry);
  }
  return [...seen].sort((a, b) => a.name.localeCompare(b.name));
}

/** The stable key to STORE for a picked person: employee doc id, else uid, else email. */
export function personKey(entry: PersonEntry): string {
  return entry.employeeId ?? entry.uid ?? entry.email ?? '';
}

/** The display name for a person key, or undefined. NEVER returns the id. */
export function personNameOf(id: string | null | undefined): string | undefined {
  return lookupPerson(id)?.name;
}

/**
 * Test / storybook seam: load entries without Firestore and mark the
 * directory ready. Keys are built exactly as for live data.
 */
export function primePeopleDirectory(entries: PersonEntry[]): void {
  primed = true;
  employeeEntries = entries.filter((e) => e.source === 'employee');
  userEntries = entries.filter((e) => e.source !== 'employee');
  settled = new Set(SOURCES);
  failed = new Set();
  rebuild('ready');
}

/** Tear everything down (call from a test's beforeEach). */
export function resetPeopleDirectory(): void {
  for (const u of unsubscribers) {
    try {
      u();
    } catch {
      /* already closed */
    }
  }
  unsubscribers = [];
  listeners = new Set();
  started = false;
  primed = false;
  employeeEntries = [];
  userEntries = [];
  settled = new Set();
  failed = new Set();
  lastRefusal = undefined;
  snapshot = EMPTY;
}
