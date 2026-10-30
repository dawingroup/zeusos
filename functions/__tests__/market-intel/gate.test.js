/**
 * Market Intelligence callable gate (audit 2026-10, E1 / WP1): the pure
 * policy and the HttpsError codes the handlers surface.
 *
 *    cd functions && node --test __tests__/market-intel/gate.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { marketIntelAllows, assertMarketIntelCaller, NEEDS } = require('../../src/lib/marketIntelGate');

const staff = (globalRole, extra = {}) => ({ globalRole, isActive: true, email: 'x@zeus.test', ...extra });
const token = (extra = {}) => ({ email: 'x@zeus.test', firebase: { sign_in_provider: 'password' }, ...extra });
const anonymous = () => ({ firebase: { sign_in_provider: 'anonymous' } });

test('NEEDS are view, edit, admin and an unknown need throws', () => {
  assert.deepEqual([...NEEDS], ['view', 'edit', 'admin']);
  assert.throws(() => marketIntelAllows({ token: token(), user: staff('admin') }, 'staff'), /unknown need/);
});

test('a portal (anonymous) identity may do nothing, whatever its profile says', () => {
  for (const need of NEEDS) {
    assert.equal(marketIntelAllows({ token: anonymous(), user: staff('owner') }, need), false, need);
  }
  assert.equal(marketIntelAllows({ token: null, user: staff('owner') }, 'view'), false);
});

test('a signed-in identity without a staff profile may do nothing', () => {
  assert.equal(marketIntelAllows({ token: token(), user: null }, 'view'), false);
  assert.equal(marketIntelAllows({ token: token(), user: null }, 'edit'), false);
});

test('an inactive profile may do nothing', () => {
  assert.equal(marketIntelAllows({ token: token(), user: staff('manager', { isActive: false }) }, 'view'), false);
});

test('any active staff profile may view; viewers may not edit; members and above may edit', () => {
  assert.equal(marketIntelAllows({ token: token(), user: staff('viewer') }, 'view'), true);
  assert.equal(marketIntelAllows({ token: token(), user: staff('viewer') }, 'edit'), false);
  for (const role of ['member', 'manager']) {
    assert.equal(marketIntelAllows({ token: token(), user: staff(role) }, 'view'), true, role);
    assert.equal(marketIntelAllows({ token: token(), user: staff(role) }, 'edit'), true, role);
    assert.equal(marketIntelAllows({ token: token(), user: staff(role) }, 'admin'), false, role);
  }
  // A profile with no globalRole at all is treated as a member.
  assert.equal(marketIntelAllows({ token: token(), user: { isActive: true } }, 'edit'), true);
});

test('owners / admins (globalRole) and the super-user emails pass every need', () => {
  for (const role of ['admin', 'owner']) {
    for (const need of NEEDS) assert.equal(marketIntelAllows({ token: token(), user: staff(role) }, need), true, `${role}/${need}`);
  }
  const superToken = token({ email: 'admin@zeusgroup.co.ug' });
  for (const need of NEEDS) assert.equal(marketIntelAllows({ token: superToken, user: null }, need), true, `super/${need}`);
});

test('an executive claim reads and writes without a profile, but is not an administrator', () => {
  const exec = token({ role: 'director' });
  assert.equal(marketIntelAllows({ token: exec, user: null }, 'view'), true);
  assert.equal(marketIntelAllows({ token: exec, user: null }, 'edit'), true);
  assert.equal(marketIntelAllows({ token: exec, user: null }, 'admin'), false);
});

test('assertMarketIntelCaller: unauthenticated / permission-denied codes and the returned profile', async () => {
  const loadUserDoc = async (uid) => ({ viewer: staff('viewer'), member: staff('member'), ghost: null }[uid] ?? null);
  const deps = { loadUserDoc };

  await assert.rejects(
    assertMarketIntelCaller(null, { need: 'view', action: 'scan market news' }, deps),
    (e) => e.code === 'unauthenticated' && /Sign in to scan market news/.test(e.message),
  );
  await assert.rejects(
    assertMarketIntelCaller({ uid: 'member', token: anonymous() }, { need: 'view', action: 'scan market news' }, deps),
    (e) => e.code === 'permission-denied' && /client-portal session/.test(e.message),
  );
  await assert.rejects(
    assertMarketIntelCaller({ uid: 'ghost', token: token() }, { need: 'view', action: 'read reports' }, deps),
    (e) => e.code === 'permission-denied' && /active ZeusOS staff profile/.test(e.message),
  );
  await assert.rejects(
    assertMarketIntelCaller({ uid: 'viewer', token: token() }, { need: 'edit', action: 'scan market news' }, deps),
    (e) => e.code === 'permission-denied' && /Viewers cannot scan market news/.test(e.message),
  );
  await assert.rejects(
    assertMarketIntelCaller({ uid: 'member', token: token() }, { need: 'admin', action: 'backfill' }, deps),
    (e) => e.code === 'permission-denied' && /Only an administrator/.test(e.message),
  );

  const ok = await assertMarketIntelCaller({ uid: 'member', token: token() }, { need: 'edit', action: 'scan market news' }, deps);
  assert.equal(ok.uid, 'member');
  assert.equal(ok.user.globalRole, 'member');
  const view = await assertMarketIntelCaller({ uid: 'viewer', token: token() }, { need: 'view', action: 'read reports' }, deps);
  assert.equal(view.user.globalRole, 'viewer');
});
