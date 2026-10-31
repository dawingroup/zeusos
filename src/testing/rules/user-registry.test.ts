/**
 * Firestore rules — nobody writes themselves into authority.
 *
 * `isAdmin()` and `isSuperUser()` trust `globalRole` on `users/{uid}`, and
 * merely having that document passes `isInternalStaff()`, so a signed-in
 * identity must not be able to create its own or edit those fields. A
 * super-user address counts only once verified.
 *
 * Requires the Firestore emulator (port 8080). Run:
 *   npm run test:rules:emulated
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { bootstrap, teardown, seedFixtures, PARENT_ADMIN_UID, SUBSIDIARY_USER_UID } from './setup';

let env: RulesTestEnvironment;

const google = { firebase: { sign_in_provider: 'google.com' } };
const stranger = () => env.authenticatedContext('stranger', { ...google, email: 'stranger@else.test', email_verified: true }).firestore();
const portal = () => env.authenticatedContext('portal-session', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const member = () => env.authenticatedContext(SUBSIDIARY_USER_UID, google).firestore();
const parentAdmin = () => env.authenticatedContext(PARENT_ADMIN_UID, google).firestore();
const claimedSuper = () =>
  env.authenticatedContext('claimed', { firebase: { sign_in_provider: 'password' }, email: 'admin@zeusgroup.co.ug', email_verified: false }).firestore();
const verifiedSuper = () =>
  env.authenticatedContext('verified', { ...google, email: 'admin@zeusgroup.co.ug', email_verified: true }).firestore();

beforeAll(async () => {
  env = await bootstrap();
  await seedFixtures(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', 'default', 'users', 'staff-1'), {
      uid: 'staff-1',
      email: 'staff@zeus.test',
      globalRole: 'admin',
    });
  });
});

afterAll(async () => {
  await teardown();
});

describe('users/{uid}', () => {
  test('a signed-in stranger cannot create their own profile, with or without a role', async () => {
    await assertFails(setDoc(doc(stranger(), 'users', 'stranger'), { globalRole: 'owner' }));
    await assertFails(setDoc(doc(stranger(), 'users', 'stranger'), { displayName: 'Just me' }));
  });

  test('a portal session cannot create one either', async () => {
    await assertFails(setDoc(doc(portal(), 'users', 'portal-session'), { globalRole: 'owner' }));
  });

  test('a member cannot raise their own role, move brand, or delete their profile', async () => {
    await assertFails(updateDoc(doc(member(), 'users', SUBSIDIARY_USER_UID), { globalRole: 'owner' }));
    await assertFails(updateDoc(doc(member(), 'users', SUBSIDIARY_USER_UID), { homeOrgId: 'zeus-group' }));
    await assertFails(updateDoc(doc(member(), 'users', SUBSIDIARY_USER_UID), { platformRole: 'admin' }));
    await assertFails(updateDoc(doc(member(), 'users', SUBSIDIARY_USER_UID), { displayName: 'Me', globalRole: 'admin' }));
    await assertFails(deleteDoc(doc(member(), 'users', SUBSIDIARY_USER_UID)));
  });

  test('a member keeps their display fields, and only their own', async () => {
    await assertSucceeds(updateDoc(doc(member(), 'users', SUBSIDIARY_USER_UID), { displayName: 'New name', jobTitle: 'Producer' }));
    await assertFails(updateDoc(doc(member(), 'users', PARENT_ADMIN_UID), { displayName: 'Not mine' }));
  });

  test('an admin still manages the registry', async () => {
    await assertSucceeds(setDoc(doc(parentAdmin(), 'users', 'new-hire'), { globalRole: 'member' }));
    await assertSucceeds(updateDoc(doc(parentAdmin(), 'users', 'new-hire'), { globalRole: 'admin' }));
    await assertSucceeds(deleteDoc(doc(parentAdmin(), 'users', 'new-hire')));
  });

  test('a person still reads the directory and writes their own settings', async () => {
    await assertSucceeds(getDoc(doc(member(), 'users', PARENT_ADMIN_UID)));
    await assertSucceeds(setDoc(doc(member(), 'users', SUBSIDIARY_USER_UID, 'settings', 'preferences'), { theme: 'dark' }));
    await assertFails(setDoc(doc(member(), 'users', PARENT_ADMIN_UID, 'settings', 'preferences'), { theme: 'dark' }));
  });
});

describe('super-user addresses', () => {
  test('an unverified address is nobody', async () => {
    await assertFails(setDoc(doc(claimedSuper(), 'users', 'claimed'), { globalRole: 'owner' }));
  });

  test('a verified one is an admin', async () => {
    await assertSucceeds(setDoc(doc(verifiedSuper(), 'users', 'provisioned'), { globalRole: 'member' }));
  });
});

describe('organizations/default/users uid self-heal', () => {
  test('an unverified address cannot repoint a profile at itself', async () => {
    const claimant = env
      .authenticatedContext('claimant', { firebase: { sign_in_provider: 'password' }, email: 'staff@zeus.test', email_verified: false })
      .firestore();
    await assertFails(updateDoc(doc(claimant, 'organizations', 'default', 'users', 'staff-1'), { uid: 'claimant' }));
  });

  test('the verified owner of the address can still heal it', async () => {
    const owner = env
      .authenticatedContext('staff-2', { ...google, email: 'staff@zeus.test', email_verified: true })
      .firestore();
    await assertSucceeds(updateDoc(doc(owner, 'organizations', 'default', 'users', 'staff-1'), { uid: 'staff-2' }));
  });
});
