import { useCallback, useSyncExternalStore } from 'react';
import {
  getPeopleDirectorySnapshot,
  lookupPerson,
  subscribePeopleDirectory,
  type PersonEntry,
} from './peopleDirectoryStore';

export interface PeopleDirectory {
  /** Display name for an employee id / auth uid / email, or undefined. Never the id. */
  nameOf: (id: string | null | undefined) => string | undefined;
  lookup: (id: string | null | undefined) => PersonEntry | undefined;
  /** True until both the employees and users listeners have delivered (or been refused) once. */
  loading: boolean;
  ready: boolean;
}

/**
 * Shared people directory for tables and lists. One Firestore subscription
 * per session, shared by every mount; `nameOf` is stable per snapshot so it
 * can be called inside a row `.map`.
 *
 *   const { nameOf } = usePeopleDirectory();
 *   rows.map((r) => <td>{nameOf(r.performedBy) ?? '—'}</td>)
 *
 * For a single value prefer `<PersonName id={…} />`, which also handles the
 * loading skeleton and the unresolved placeholder.
 */
export function usePeopleDirectory(): PeopleDirectory {
  const snap = useSyncExternalStore(subscribePeopleDirectory, getPeopleDirectorySnapshot, getPeopleDirectorySnapshot);
  // `lookupPerson` reads the module snapshot, but depending on `snap` here
  // re-creates the callbacks exactly when the map changes, so memoised rows
  // re-render with the new names.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lookup = useCallback((id: string | null | undefined) => lookupPerson(id), [snap]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nameOf = useCallback((id: string | null | undefined) => lookupPerson(id)?.name, [snap]);
  const ready = snap.status === 'ready' || snap.status === 'error';
  return { nameOf, lookup, loading: !ready, ready };
}
