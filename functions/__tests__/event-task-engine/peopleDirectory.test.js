/**
 * The people work can reach are the people the gates recognise: a staff profile
 * at organizations/default/users (canonical) or users (legacy).
 *   cd functions && node --test __tests__/event-task-engine/peopleDirectory.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { loadDirectory, findOwnerUser, resolvePersonUid } = require('../../src/event-task-engine/lib/peopleDirectory');

/** The reads the directory uses, over { 'collection/path': { docId: data } }. */
function fakeDb(collections) {
  const query = (path, filters = []) => ({
    where: (field, op, value) => query(path, [...filters, { field, op, value }]),
    limit: () => query(path, filters),
    doc: (id) => ({
      get: async () => {
        const data = (collections[path] || {})[id];
        return { exists: data !== undefined, id, data: () => data };
      },
    }),
    get: async () => {
      const docs = Object.entries(collections[path] || {})
        .filter(([, data]) => filters.every(({ field, op, value }) => (op === 'in' ? value.includes(data[field]) : data[field] === value)))
        .map(([id, data]) => ({ id, data: () => data }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });
  return { collection: (path) => query(path) };
}

const REAL_OWNER = { uid: 'real-owner', email: 'owner@zeus.test', displayName: 'Real Owner', globalRole: 'owner', isActive: true };
const SEEDED = {
  'u-amara': { email: 'amara@zeusgroup.test', displayName: 'Amara', globalRole: 'admin' },
  'u-brian': { email: 'brian@zeusgroup.test', displayName: 'Brian', globalRole: 'member' },
};
const production = () => fakeDb({
  'organizations/default/users': { 'real-owner': REAL_OWNER },
  users: SEEDED,
  employees: {},
});

test('the last stop for unowned work is the real owner, not a seeded admin in root users', async () => {
  const owner = await findOwnerUser(production());
  assert.equal(owner.uid, 'real-owner');
  assert.equal(owner.matchedRole, 'owner');
});

test('with no owner anywhere it falls to an admin from either place, and skips the inactive', async () => {
  const db = fakeDb({
    'organizations/default/users': { gone: { email: 'a@zeus.test', globalRole: 'admin', isActive: false } },
    users: { later: { email: 'b@zeus.test', globalRole: 'admin' } },
  });
  assert.equal((await findOwnerUser(db)).uid, 'later');
});

test('a person with only a canonical profile is in the directory, by uid and by email', async () => {
  const directory = await loadDirectory(production());
  assert.equal(directory.get('real-owner').name, 'Real Owner');
  assert.equal(directory.get('owner@zeus.test').uid, 'real-owner');
});

test('when both places hold a uid the canonical profile wins', async () => {
  const db = fakeDb({
    'organizations/default/users': { dual: { email: 'dual@zeus.test', displayName: 'Canonical' } },
    users: { dual: { email: 'dual@zeus.test', displayName: 'Legacy' } },
    employees: {},
  });
  assert.equal((await loadDirectory(db)).get('dual').name, 'Canonical');
});

test('an employee links to a canonical profile by email', async () => {
  const db = fakeDb({
    'organizations/default/users': { 'real-owner': REAL_OWNER },
    users: {},
    employees: { 'emp-1': { fullName: 'Real Owner', email: 'owner@zeus.test', employmentStatus: 'active' } },
  });
  assert.equal((await loadDirectory(db)).get('emp-1').uid, 'real-owner');
  assert.deepEqual(await resolvePersonUid(db, 'emp-1'), { uid: 'real-owner', name: 'Real Owner', employeeId: 'emp-1' });
});

test('resolvePersonUid finds a canonical profile by uid and email, and a legacy one still', async () => {
  const db = production();
  assert.equal((await resolvePersonUid(db, 'real-owner')).uid, 'real-owner');
  assert.equal((await resolvePersonUid(db, 'owner@zeus.test')).uid, 'real-owner');
  assert.equal((await resolvePersonUid(db, 'u-brian')).uid, 'u-brian');
  assert.equal(await resolvePersonUid(db, 'nobody'), null);
});
