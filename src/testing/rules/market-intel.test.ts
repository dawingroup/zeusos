/**
 * Firestore rules — Market Intelligence (audit 2026-10, WP1).
 *
 * Verifies the mirrored gate: reading needs an active staff profile, writing
 * refuses the `viewer` globalRole, a competitor hard-delete is admin-only,
 * reports are server-written, a reader may only mark news read/bookmarked,
 * and the retired collections (market_insights, environment_signals, …) deny
 * everyone.
 *
 * Requires the Firestore emulator (port 8080). Run:
 *   npm run test:rules:emulated
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, test } from 'vitest';
import {
  bootstrap,
  teardown,
  seedFixtures,
  PARENT_ADMIN_UID,
  SUBSIDIARY_USER_UID,
  SUBSIDIARY_ORG_ID,
} from './setup';

const VIEWER_UID = 'viewer-uid';
const INACTIVE_UID = 'inactive-uid';
const NO_PROFILE_UID = 'no-profile-uid';
const COMPETITOR_ID = 'competitor_acme';
const ARTICLE_ID = 'article_1';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await bootstrap();
  await seedFixtures(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', VIEWER_UID), { email: 'viewer@zeusgroup.test', globalRole: 'viewer', homeOrgId: SUBSIDIARY_ORG_ID, isActive: true });
    await setDoc(doc(db, 'users', INACTIVE_UID), { email: 'gone@zeusgroup.test', globalRole: 'member', homeOrgId: SUBSIDIARY_ORG_ID, isActive: false });
    await setDoc(doc(db, 'competitors', COMPETITOR_ID), {
      name: 'Acme Creative',
      status: 'active',
      subsidiariesCompeting: ['zeus-the-agency'],
    });
    await setDoc(doc(db, 'competitor_swot', 'swot_1'), { competitorId: COMPETITOR_ID });
    await setDoc(doc(db, 'news_articles', ARTICLE_ID), { title: 'Acme wins pitch', isRead: false, isBookmarked: false });
    await setDoc(doc(db, 'market_intelligence_reports', 'r_1'), { title: 'Scan', subsidiaryId: 'zeus-the-agency', source: 'ai_scan' });
    await setDoc(doc(db, 'social_metrics', 'm_1'), { competitorId: COMPETITOR_ID, followers: 10 });
  });
});

afterAll(async () => {
  await teardown();
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const portal = () => env.authenticatedContext('portal-anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore();

describe('market intelligence rules — read', () => {
  test('an active brand member reads competitors', async () => {
    await assertSucceeds(getDoc(doc(as(SUBSIDIARY_USER_UID), 'competitors', COMPETITOR_ID)));
  });
  test('a viewer reads competitors and reports', async () => {
    await assertSucceeds(getDoc(doc(as(VIEWER_UID), 'competitors', COMPETITOR_ID)));
    await assertSucceeds(getDoc(doc(as(VIEWER_UID), 'market_intelligence_reports', 'r_1')));
  });
  test('an inactive profile, a signed-in identity with no profile, and a portal session read nothing', async () => {
    await assertFails(getDoc(doc(as(INACTIVE_UID), 'competitors', COMPETITOR_ID)));
    await assertFails(getDoc(doc(as(NO_PROFILE_UID), 'competitors', COMPETITOR_ID)));
    await assertFails(getDoc(doc(portal(), 'competitors', COMPETITOR_ID)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'competitors', COMPETITOR_ID)));
  });
});

describe('market intelligence rules — write', () => {
  test('a brand member creates and updates a competitor and archives it, but cannot hard-delete', async () => {
    const db = as(SUBSIDIARY_USER_UID);
    await assertSucceeds(setDoc(doc(db, 'competitors', 'competitor_new'), { name: 'New', status: 'active', subsidiariesCompeting: [] }));
    await assertSucceeds(updateDoc(doc(db, 'competitors', COMPETITOR_ID), { archived: true, archiveReason: 'Out of market' }));
    await assertFails(deleteDoc(doc(db, 'competitors', COMPETITOR_ID)));
  });
  test('a brand member may delete a child row (stop tracking) but not a report', async () => {
    const db = as(SUBSIDIARY_USER_UID);
    await assertSucceeds(deleteDoc(doc(db, 'competitor_swot', 'swot_1')));
    await assertFails(deleteDoc(doc(db, 'market_intelligence_reports', 'r_1')));
  });
  test('a viewer cannot write a competitor', async () => {
    await assertFails(setDoc(doc(as(VIEWER_UID), 'competitors', 'competitor_viewer'), { name: 'X' }));
    await assertFails(updateDoc(doc(as(VIEWER_UID), 'competitors', COMPETITOR_ID), { notes: 'x' }));
  });
  test('a viewer may mark an article read or bookmarked, and nothing else', async () => {
    const db = as(VIEWER_UID);
    await assertSucceeds(updateDoc(doc(db, 'news_articles', ARTICLE_ID), { isRead: true }));
    await assertSucceeds(updateDoc(doc(db, 'news_articles', ARTICLE_ID), { isBookmarked: true, updatedAt: 'now' }));
    await assertFails(updateDoc(doc(db, 'news_articles', ARTICLE_ID), { title: 'Rewritten' }));
  });
  test('nobody creates a report from the client; metrics rows are append-only', async () => {
    await assertFails(setDoc(doc(as(SUBSIDIARY_USER_UID), 'market_intelligence_reports', 'r_client'), { title: 'x' }));
    await assertFails(setDoc(doc(as(PARENT_ADMIN_UID), 'market_intelligence_reports', 'r_admin'), { title: 'x' }));
    await assertFails(updateDoc(doc(as(SUBSIDIARY_USER_UID), 'social_metrics', 'm_1'), { followers: 11 }));
  });
  test('an admin hard-deletes a competitor', async () => {
    await assertSucceeds(deleteDoc(doc(as(PARENT_ADMIN_UID), 'competitors', COMPETITOR_ID)));
  });
});

describe('market intelligence rules — retired collections deny everyone', () => {
  test.each(['market_insights', 'environment_signals', 'market_signals', 'profile_snapshots'])('%s', async (coll) => {
    await assertFails(setDoc(doc(as(PARENT_ADMIN_UID), coll, 'x'), { a: 1 }));
    await assertFails(getDoc(doc(as(SUBSIDIARY_USER_UID), coll, 'x')));
  });
  test('executive/market_intelligence/** is gone', async () => {
    await assertFails(setDoc(doc(as(PARENT_ADMIN_UID), 'executive', 'market_intelligence', 'reports', 'x'), { a: 1 }));
  });
});
