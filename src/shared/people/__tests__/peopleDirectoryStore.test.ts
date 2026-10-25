/**
 * The directory resolves the SAME person from every key a writer might have
 * stamped, and never hands back the id.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  onSnapshot: vi.fn(),
}));
vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));

import { onSnapshot } from 'firebase/firestore';
import {
  getPeopleDirectorySnapshot,
  lookupPerson,
  personNameOf,
  primePeopleDirectory,
  resetPeopleDirectory,
  subscribePeopleDirectory,
} from '../peopleDirectoryStore';

const jane = {
  name: 'Jane Okello',
  employeeId: 'emp-jane',
  uid: 'uid-jane-28chars',
  email: 'Jane@zeustheagency.com',
  source: 'employee' as const,
};

describe('peopleDirectoryStore', () => {
  beforeEach(() => resetPeopleDirectory());

  it('starts idle and moves to loading on the first subscriber', () => {
    expect(getPeopleDirectorySnapshot().status).toBe('idle');
    const unsub = subscribePeopleDirectory(() => {});
    expect(getPeopleDirectorySnapshot().status).toBe('loading');
    unsub();
  });

  it('resolves one person by employee id, auth uid and email (case-insensitive)', () => {
    primePeopleDirectory([jane]);
    expect(personNameOf('emp-jane')).toBe('Jane Okello');
    expect(personNameOf('uid-jane-28chars')).toBe('Jane Okello');
    expect(personNameOf('jane@zeustheagency.com')).toBe('Jane Okello');
    expect(personNameOf(' JANE@zeustheagency.com ')).toBe('Jane Okello');
  });

  it('never returns the id for an unknown key', () => {
    primePeopleDirectory([jane]);
    expect(personNameOf('someone-else')).toBeUndefined();
    expect(personNameOf('')).toBeUndefined();
    expect(personNameOf(null)).toBeUndefined();
  });

  it('prefers a live employee over a users doc over a deleted employee on a shared key', () => {
    primePeopleDirectory([
      { name: 'Old Record', employeeId: 'emp-old', uid: 'uid-x', source: 'employee', isDeleted: true },
      { name: 'Portal Profile', uid: 'uid-x', source: 'user' },
    ]);
    expect(personNameOf('uid-x')).toBe('Portal Profile');
    primePeopleDirectory([
      { name: 'Old Record', employeeId: 'emp-old', uid: 'uid-x', source: 'employee', isDeleted: true },
      { name: 'Portal Profile', uid: 'uid-x', source: 'user' },
      { name: 'Current Employee', employeeId: 'emp-new', uid: 'uid-x', source: 'employee' },
    ]);
    expect(personNameOf('uid-x')).toBe('Current Employee');
  });

  it('still resolves a leaver when nobody else holds the key', () => {
    primePeopleDirectory([{ name: 'Gone Person', employeeId: 'emp-gone', source: 'employee', isDeleted: true }]);
    expect(personNameOf('emp-gone')).toBe('Gone Person');
  });

  it('names automated writers instead of "Unknown user"', () => {
    primePeopleDirectory([]);
    expect(personNameOf('system')).toBe('System');
    expect(personNameOf('agent:ZA-002')).toBe('ZeusOS agent');
    expect(personNameOf('ZA-004')).toBe('ZeusOS agent');
    expect(lookupPerson('mcp:zeusos_create_brief')?.source).toBe('system');
  });

  /** Captures each source's callbacks, in subscription order: employees, users. */
  function captureSubscriptions() {
    const sources: Array<{ onData: (snap: unknown) => void; onError: (err: unknown) => void }> = [];
    vi.mocked(onSnapshot).mockImplementation(((_ref: unknown, onData: (snap: unknown) => void, onError: (err: unknown) => void) => {
      sources.push({ onData, onError });
      return () => {};
    }) as never);
    return sources;
  }
  type Row = { id: string; data: () => Record<string, unknown> };
  const snapOf = (rows: Array<[string, Record<string, unknown>]>) => ({
    forEach: (fn: (d: Row) => void) => rows.forEach(([id, data]) => fn({ id, data: () => data })),
  });
  const denied = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

  it('reads the staff file and the profiles — employees first', () => {
    const sources = captureSubscriptions();
    subscribePeopleDirectory(() => {});
    expect(sources).toHaveLength(2);
  });

  it('builds entries from live employee and user snapshots, keeping only display fields', () => {
    const sources = captureSubscriptions();
    const listener = vi.fn();
    subscribePeopleDirectory(listener);

    sources[0]!.onData(
      snapOf([
        ['emp-1', { firstName: 'Amos', lastName: 'Byaruhanga', email: 'amos@zeustheagency.com', systemAccess: { userId: 'uid-amos' }, compensation: { salary: 1_000_000 } }],
        ['emp-2', { fullName: '', firstName: '', lastName: '' }], // nameless → dropped
        ['emp-3', { firstName: 'Left', lastName: 'Person', status: 'terminated' }],
      ]),
    );
    expect(getPeopleDirectorySnapshot().status).toBe('loading');
    sources[1]!.onData(snapOf([['uid-admin', { name: 'Admin Person', email: 'admin@zeustheagency.com', photoURL: 'https://x/y.png' }]]));
    expect(getPeopleDirectorySnapshot().status).toBe('ready');

    expect(personNameOf('emp-1')).toBe('Amos Byaruhanga');
    expect(personNameOf('uid-amos')).toBe('Amos Byaruhanga');
    expect(personNameOf('uid-admin')).toBe('Admin Person');
    expect(lookupPerson('uid-admin')?.photoUrl).toBe('https://x/y.png');
    expect(personNameOf('emp-2')).toBeUndefined();
    expect(lookupPerson('emp-3')?.isDeleted).toBe(true);
    expect(JSON.stringify(lookupPerson('emp-1'))).not.toContain('salary');
    expect(listener).toHaveBeenCalled();
  });

  it('resolves from the profiles when the staff file is closed to this person', () => {
    const sources = captureSubscriptions();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    subscribePeopleDirectory(() => {});

    sources[0]!.onError(denied);
    expect(getPeopleDirectorySnapshot().status).toBe('loading');
    sources[1]!.onData(snapOf([['uid-admin', { displayName: 'Admin Person' }]]));

    expect(getPeopleDirectorySnapshot().status).toBe('ready');
    expect(getPeopleDirectorySnapshot().error).toBeUndefined();
    expect(personNameOf('uid-admin')).toBe('Admin Person');
    warn.mockRestore();
  });

  it('is an error only when nothing can answer — both sources refused', () => {
    const sources = captureSubscriptions();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    subscribePeopleDirectory(() => {});
    sources[0]!.onError(denied);
    sources[1]!.onError(denied);
    expect(getPeopleDirectorySnapshot().status).toBe('error');
    expect(getPeopleDirectorySnapshot().error).toBe(denied);
    warn.mockRestore();
  });

  it('stays loading (and does not throw) when onSnapshot is inert, as under a unit mock', () => {
    vi.mocked(onSnapshot).mockImplementation((() => undefined) as never);
    subscribePeopleDirectory(() => {});
    expect(getPeopleDirectorySnapshot().status).toBe('loading');
    expect(personNameOf('anything')).toBeUndefined();
  });
});
