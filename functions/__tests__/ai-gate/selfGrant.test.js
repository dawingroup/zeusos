/**
 * Nobody signs in and makes themselves an administrator.
 *   cd functions && node --test __tests__/ai-gate/selfGrant.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'zeusos-test' });

const { isSuper, isSuperEmailToken } = require('../../src/assignment/lib/auth');
const { assertMayInitializeFirstAdmin } = require('../../src/auth/setCustomClaims');
const { processNewUserInvite } = require('../../src/auth/userInvites');

const code = (c) => (err) => err.code === c;
const SUPER = 'admin@zeusgroup.co.ug';

test('a super-user address counts only once verified', () => {
  assert.equal(isSuperEmailToken({ email: SUPER, email_verified: true }), true);
  assert.equal(isSuperEmailToken({ email: SUPER, email_verified: false }), false);
  assert.equal(isSuperEmailToken({ email: SUPER }), false);
  assert.equal(isSuperEmailToken({ email: 'someone@else.test', email_verified: true }), false);
  assert.equal(isSuper({ email: SUPER }, null), false);
  assert.equal(isSuper({}, { globalRole: 'owner' }), true);
});

test('initializeFirstAdmin refuses anyone who is not already an administrator', async () => {
  const none = { loadUserDoc: async () => null };
  const member = { loadUserDoc: async () => ({ globalRole: 'member', isActive: true }) };
  const owner = { loadUserDoc: async () => ({ globalRole: 'owner', isActive: true }) };

  await assert.rejects(assertMayInitializeFirstAdmin(null, none), code('unauthenticated'));
  await assert.rejects(assertMayInitializeFirstAdmin({ uid: 'stranger', token: { email: 'a@b.test', email_verified: true } }, none), code('permission-denied'));
  await assert.rejects(assertMayInitializeFirstAdmin({ uid: 'm', token: {} }, member), code('permission-denied'));
  await assert.rejects(assertMayInitializeFirstAdmin({ uid: 'portal', token: { firebase: { sign_in_provider: 'anonymous' } } }, none), code('permission-denied'));
  await assert.rejects(assertMayInitializeFirstAdmin({ uid: 'c', token: { email: SUPER, email_verified: false } }, none), code('permission-denied'));

  await assert.doesNotReject(assertMayInitializeFirstAdmin({ uid: 'o', token: {} }, owner));
  await assert.doesNotReject(assertMayInitializeFirstAdmin({ uid: 's', token: { email: SUPER, email_verified: true } }, none));
});

test('an unverified address cannot claim an invite, and nothing is read', async () => {
  const result = await processNewUserInvite.run({ auth: { uid: 'u', token: { email: 'invited@zeus.test', email_verified: false } } });
  assert.deepEqual(result, { hasInvite: false, reason: 'unverified_email' });
});
