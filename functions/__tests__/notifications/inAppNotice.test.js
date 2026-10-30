/**
 * One notice shape (stream C): a notice names one person, starts unread, goes
 * where an in-app path says, and ranks on one priority ladder; the delivery
 * half writes it once per person and resolves audiences to people.
 *
 *    cd functions && node --test __tests__/notifications/inAppNotice.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { buildNotice, inAppPath, noticePriority, noticeDocId, PRIORITY_OF, READER_WRITABLE_FIELDS, NOTICE_ORG_ID } = require('../../src/lib/inAppNotice');
const { notifyUser, notifyUsers, notifyAudience, notifyRole, resolveAudience, audienceLabel } = require('../../src/lib/noticeDelivery');
const engineNotices = require('../../src/event-task-engine/lib/notices');
const { writeNotification, audienceFor } = require('../../src/agents/handlers/notify');

const quiet = { info() {}, warn() {}, error() {} };
const NOW = '2026-10-29T09:00:00.000Z';

function seedPeople(db) {
  db._seed('users/u-ceo', { uid: 'u-ceo', email: 'ceo@zeus.co.ke', displayName: 'Zuri', globalRole: 'owner', homeOrgId: 'zeus-group' });
  db._seed('users/u-fin', { uid: 'u-fin', email: 'fin@zeus.co.ke', displayName: 'Grace', globalRole: 'admin', homeOrgId: 'zeus-group' });
  db._seed('users/u-md', { uid: 'u-md', email: 'md@zeus.co.ke', displayName: 'Ben', globalRole: 'admin', homeOrgId: 'zeus-the-agency' });
  db._seed('users/u-lead', { uid: 'u-lead', email: 'lead@zeus.co.ke', displayName: 'Amina', globalRole: 'manager', homeOrgId: 'zeus-the-agency', deliveryLeadFor: ['zeus-the-agency'] });
  db._seed('users/u-ae', { uid: 'u-ae', email: 'ae@zeus.co.ke', displayName: 'Carol', globalRole: 'member', homeOrgId: 'zeus-the-agency' });
  db._seed('users/u-gone', { uid: 'u-gone', email: 'gone@zeus.co.ke', globalRole: 'admin', homeOrgId: 'zeus-the-agency', isActive: false });
  db._seed('organizations/default/users/u-old', { uid: 'u-old', email: 'old@zeus.co.ke', displayName: 'Old Org User', globalRole: 'member', homeOrgId: 'labyrinth' });
}
const notices = (db) => db._dump_prefix('notifications').map((n) => ({ id: n.path.split('/').pop(), ...n.data }));

test('a notice names one person, starts unread and unarchived, and carries an in-app path', () => {
  const n = buildNotice({ userId: 'u1', type: 'task.assigned', title: 'A task for you', message: 'Brief the photographer', actionUrl: '/tasks/today', priority: 'P1', module: 'intelligence', entityType: 'task', entityId: 't1', source: 'task-engine' });
  assert.deepEqual(n, {
    userId: 'u1', organizationId: NOTICE_ORG_ID, type: 'task.assigned', title: 'A task for you', message: 'Brief the photographer',
    module: 'intelligence', entityType: 'task', entityId: 't1', actionUrl: '/tasks/today', priority: 'high', isRead: false, isArchived: false, source: 'task-engine',
  });
  assert.equal(buildNotice({ userId: 'u', type: 't', title: 'x'.repeat(300) }).title.length, 200);
  assert.throws(() => buildNotice({ type: 't', title: 'x' }), /userId/);
  assert.throws(() => buildNotice({ userId: 'u', title: 'x' }), /type/);
  assert.throws(() => buildNotice({ userId: 'u', type: 't' }), /title/);
});

test('only in-app paths survive as actionUrl; severities and task priorities land on one ladder', () => {
  assert.equal(inAppPath('/memos/m1'), '/memos/m1');
  assert.equal(inAppPath('https://evil.example'), null);
  assert.equal(inAppPath('//evil.example'), null);
  assert.equal(inAppPath('memos/m1'), null);
  for (const [word, rank] of Object.entries(PRIORITY_OF)) assert.equal(noticePriority(word), rank, word);
  assert.equal(noticePriority('P0'), 'critical');
  assert.equal(noticePriority('nonsense'), 'medium');
  assert.equal(noticeDocId('deadline-summary:2026/10/29', 'u1'), 'deadline-summary:2026_10_29_u1');
  assert.deepEqual([...READER_WRITABLE_FIELDS], ['isRead', 'isArchived', 'readAt', 'archivedAt', 'updatedAt']);
});

test('a deduped notice is written once per person, and a repeat never flips it back to unread', async () => {
  const { db } = makeFirestore();
  assert.equal(await notifyUser(db, { userId: 'u1', type: 'daily', title: 'Today', dedupeKey: 'daily:2026-10-29' }, { nowIso: NOW, logger: quiet }), true);
  db._seed('notifications/daily:2026-10-29_u1', { ...notices(db)[0], isRead: true });
  assert.equal(await notifyUser(db, { userId: 'u1', type: 'daily', title: 'Today', dedupeKey: 'daily:2026-10-29' }, { nowIso: NOW, logger: quiet }), false);
  assert.equal(notices(db).length, 1);
  assert.equal(notices(db)[0].isRead, true, 'still read');
  assert.equal(notices(db)[0].createdAt, NOW);
  assert.equal(await notifyUser(db, { userId: 'u1', type: 'other', title: 'No key' }, { nowIso: NOW, logger: quiet }), true);
  assert.equal(notices(db).length, 2);
});

test('an invalid notice or a failed write never throws into the caller', async () => {
  const { db } = makeFirestore();
  const warned = [];
  const log = { ...quiet, warn: (m) => warned.push(m) };
  assert.equal(await notifyUser(db, { type: 't', title: 'x' }, { logger: log }), false);
  const broken = { collection: () => ({ add: async () => { throw new Error('boom'); }, doc: () => ({ get: async () => { throw new Error('boom'); } }) }) };
  assert.equal(await notifyUser(broken, { userId: 'u', type: 't', title: 'x' }, { logger: log }), false);
  assert.equal(await notifyUser(broken, { userId: 'u', type: 't', title: 'x', dedupeKey: 'k' }, { logger: log }), false);
  assert.equal(warned.length, 3);
  assert.equal(await notifyUsers(db, ['a', 'a', 'b', ''], { type: 't', title: 'x' }, { logger: quiet }), 2);
});

test('audiences resolve to people: a role includes the tiers above it; the parent org; a brand\'s leads then its MDs; a brand\'s staff', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  assert.deepEqual((await resolveAudience(db, { kind: 'role', role: 'admin' })).uids, ['u-ceo', 'u-fin', 'u-md'], 'admins and owners, by email, never the deactivated');
  assert.deepEqual((await resolveAudience(db, { kind: 'role', role: 'owner' })).uids, ['u-ceo']);
  assert.deepEqual((await resolveAudience(db, { kind: 'parent_org' })).uids, ['u-ceo', 'u-fin']);
  assert.deepEqual((await resolveAudience(db, { kind: 'brand_leads', subsidiaryId: 'zeus-the-agency' })).uids, ['u-lead']);
  assert.deepEqual((await resolveAudience(db, { kind: 'brand_staff', subsidiaryId: 'zeus-the-agency' })).uids, ['u-ae', 'u-lead', 'u-md']);
  assert.deepEqual((await resolveAudience(db, { kind: 'brand_staff', subsidiaryId: 'labyrinth' })).uids, ['u-old'], 'the organizations/default/users collection counts too');
  assert.deepEqual((await resolveAudience(db, { kind: 'user', uid: 'u-ae' })).uids, ['u-ae']);
  assert.deepEqual((await resolveAudience(db, { kind: 'user', personKey: 'ae@zeus.co.ke' })).uids, ['u-ae'], 'an email resolves through the people directory');
  assert.deepEqual((await resolveAudience(db, { kind: 'user', uid: 'nobody' })).uids, []);
  // A brand with no leads falls to its MDs; one with nobody at all to the owners.
  db._seed('users/u-lead', { ...db._store.get('users/u-lead'), deliveryLeadFor: [] });
  assert.deepEqual((await resolveAudience(db, { kind: 'brand_leads', subsidiaryId: 'zeus-the-agency' })).uids, ['u-md']);
  const empty = await resolveAudience(db, { kind: 'brand_leads', subsidiaryId: 'house-of-zeus' });
  assert.deepEqual(empty, { uids: ['u-ceo'], fellBack: true });
  assert.deepEqual(await resolveAudience(db, { kind: 'dragon' }), { uids: [], fellBack: false });
});

test('a role profile resolves through active role_assignments', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  db._seed('employees/emp-amina', { firstName: 'Amina', lastName: 'O', email: 'lead@zeus.co.ke', employmentStatus: 'active', systemAccess: { userId: 'u-lead' } });
  db._seed('role_assignments/ra1', { status: 'active', roleProfileId: 'rp-ecd', employeeId: 'emp-amina' });
  db._seed('role_assignments/ra2', { status: 'ended', roleProfileId: 'rp-ecd', employeeId: 'emp-x' });
  assert.deepEqual((await resolveAudience(db, { kind: 'role_profile', roleProfileId: 'rp-ecd' })).uids, ['u-lead']);
  assert.equal((await resolveAudience(db, { kind: 'role_profile', roleProfileId: 'rp-none' })).fellBack, true);
});

test('notifyAudience writes one canonical notice per person, stamped with the audience; nobody → nothing, logged', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  const r = await notifyAudience(db, { audience: { kind: 'brand_staff', subsidiaryId: 'zeus-the-agency' }, type: 'memo.issued', title: 'Memo issued', actionUrl: '/memos/m1', priority: 'low', module: 'memos', dedupeKey: 'memo_ack:m1' }, { nowIso: NOW, logger: quiet });
  assert.deepEqual(r, { recipients: ['u-ae', 'u-lead', 'u-md'], written: 3, fellBack: false });
  const rows = notices(db);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((n) => n.organizationId === 'default' && n.isRead === false && n.recipientRole === 'brand_staff:zeus-the-agency' && n.actionUrl === '/memos/m1'));
  assert.ok(rows.every((n) => n.id === `memo_ack:m1_${n.userId}`), 'deduped per person');
  const again = await notifyAudience(db, { audience: { kind: 'brand_staff', subsidiaryId: 'zeus-the-agency' }, type: 'memo.issued', title: 'Memo issued', dedupeKey: 'memo_ack:m1' }, { nowIso: NOW, logger: quiet });
  assert.equal(again.written, 0, 'a second run writes nobody twice');
  const warned = [];
  const none = await notifyAudience(db, { audience: { kind: 'user', uid: 'nobody' }, type: 't', title: 'x' }, { logger: { ...quiet, warn: (m) => warned.push(m) } });
  assert.deepEqual(none, { recipients: [], written: 0, fellBack: false });
  assert.ok(warned.some((w) => /reached nobody/.test(w)));
  assert.equal((await notifyRole(db, { role: 'owner', type: 't', title: 'x' }, { logger: quiet })).written, 1);
  assert.equal(audienceLabel({ kind: 'role', role: 'admin' }), 'role:admin');
});

test('the task engine\'s writer is the same shape, with its own module default', async () => {
  const { db } = makeFirestore();
  assert.equal(engineNotices.buildNotice({ userId: 'u', type: 't', title: 'x' }).module, 'intelligence');
  assert.equal(engineNotices.buildNotice({ userId: 'u', type: 't', title: 'x', module: 'memos' }).module, 'memos');
  await engineNotices.notifyUser(db, { userId: 'u', type: 'task.assigned', title: 'x', dedupeKey: 'k' }, { nowIso: NOW, logger: quiet });
  const [row] = notices(db);
  assert.equal(row.module, 'intelligence');
  assert.equal(row.source, 'task-engine');
  assert.equal(row.organizationId, 'default');
  assert.equal(engineNotices.noticeDocId('k', 'u'), noticeDocId('k', 'u'));
});

test('the agents\' notify handlers reach PEOPLE the bell will show, never a bare audience word', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  const ctx = { agentId: 'ZA-003' };
  const deps = { db, nowIso: NOW, logger: quiet };
  const esc = await writeNotification({ title: 'Budget overrun on IWO-014', body: 'Burn is at 112%.', actionUrl: '/delivery/iwo/iwo-14', priority: 'high', entityType: 'iwo', entityId: 'iwo-14' }, ctx, 'escalate', deps);
  assert.deepEqual(esc.result.recipients, ['u-ceo', 'u-fin']);
  assert.match(esc.summary, /Notified 2 people \(escalate\)/);
  const rows = notices(db);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((n) => n.userId && n.organizationId === 'default' && n.isRead === false && n.source === 'agent:ZA-003' && n.metadata.audience === 'escalate'));
  assert.equal(rows[0].message, 'Burn is at 112%.');
  assert.equal(rows[0].type, 'agent.escalate');
  const lead = await writeNotification({ title: 'x', targetBrandId: 'zeus-the-agency' }, ctx, 'subsidiary_lead', deps);
  assert.deepEqual(lead.result.recipients, ['u-lead']);
  const one = await writeNotification({ title: 'x', targetUserId: 'ae@zeus.co.ke' }, ctx, 'user', deps);
  assert.deepEqual(one.result.recipients, ['u-ae']);
  assert.deepEqual(audienceFor('team', { targetBrandId: 'labyrinth' }), { kind: 'brand_staff', subsidiaryId: 'labyrinth' });
});
