/**
 * Firestore rules — Asset Library RBAC (Phase 5.C).
 *
 * Verifies:
 *   1. A parent-org principal can read any asset / collection,
 *      regardless of which sub-brand owns it.
 *   2. A subsidiary principal can read only assets / collections
 *      tagged with their own `subsidiaryOrgId`.
 *   3. A subsidiary principal is denied when reading a doc tagged
 *      for a different sub-brand.
 *   4. Any staff user can create a `share_links` doc, but only with
 *      their own UID as `createdBy`.
 *   5. A share-link doc cannot be read from the client (the resolver
 *      Cloud Function runs as admin and bypasses rules).
 *   6. The original creator can revoke a share link; others cannot.
 *
 * Requires the Firestore emulator (port 8080). Run:
 *   npm run test:rules:emulated
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import {
  bootstrap,
  teardown,
  seedFixtures,
  PARENT_ADMIN_UID,
  SUBSIDIARY_USER_UID,
  OTHER_SUBSIDIARY_USER_UID,
  SUBSIDIARY_ORG_ID,
  OTHER_SUBSIDIARY_ORG_ID,
} from './setup';

const ASSET_OWN_SUB = 'asset_owned_by_zeus_the_agency';
const ASSET_OTHER_SUB = 'asset_owned_by_labyrinth';
const COLLECTION_OWN_SUB = 'collection_owned_by_zeus_the_agency';
const SHARE_TOKEN = 'tok_aaaabbbbccccdddd_demo';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await bootstrap();
  await seedFixtures(env);
  // Seed two assets + one collection so the read-path assertions have
  // something to evaluate against.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'asset_library_items', ASSET_OWN_SUB), {
      name: 'Zeus The Agency hero shot',
      category: 'PHOTO',
      subsidiaryOrgId: SUBSIDIARY_ORG_ID,
      tags: ['hero'],
      currentVersionId: 'v1',
      storageRef: `asset-library/${ASSET_OWN_SUB}/source/hero.png`,
      fileType: 'IMAGE',
      fileSizeBytes: 1024,
      status: 'ACTIVE',
      uploadedBy: SUBSIDIARY_USER_UID,
    });
    await setDoc(doc(db, 'asset_library_items', ASSET_OTHER_SUB), {
      name: 'Labyrinth brand mark',
      category: 'LOGO',
      subsidiaryOrgId: OTHER_SUBSIDIARY_ORG_ID,
      tags: ['logo'],
      currentVersionId: 'v1',
      storageRef: `asset-library/${ASSET_OTHER_SUB}/source/logo.svg`,
      fileType: 'IMAGE',
      fileSizeBytes: 2048,
      status: 'ACTIVE',
      uploadedBy: OTHER_SUBSIDIARY_USER_UID,
    });
    await setDoc(doc(db, 'asset_library_collections', COLLECTION_OWN_SUB), {
      name: 'Zeus The Agency Q3 lookbook',
      itemIds: [ASSET_OWN_SUB],
      subsidiaryOrgId: SUBSIDIARY_ORG_ID,
      createdBy: SUBSIDIARY_USER_UID,
    });
  });
});

beforeEach(async () => {
  // Each test gets a fresh share_links state but keeps the asset
  // fixtures.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    try {
      await setDoc(doc(db, 'share_links', SHARE_TOKEN), {
        token: SHARE_TOKEN,
        assetItemId: ASSET_OWN_SUB,
        createdBy: SUBSIDIARY_USER_UID,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
        allowDownload: true,
        label: 'Q3 lookbook hero',
      });
    } catch {
      /* ignore — fixture seeding only */
    }
  });
});

afterAll(async () => {
  await teardown();
});

describe('asset_library_items — subsidiary scoping', () => {
  test('parent-org admin reads any asset', async () => {
    const ctx = env.authenticatedContext(PARENT_ADMIN_UID, {
      email: 'pricing-admin@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertSucceeds(getDoc(doc(db, 'asset_library_items', ASSET_OWN_SUB)));
    await assertSucceeds(getDoc(doc(db, 'asset_library_items', ASSET_OTHER_SUB)));
  });

  test('subsidiary principal reads own subsidiary asset', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertSucceeds(getDoc(doc(db, 'asset_library_items', ASSET_OWN_SUB)));
  });

  test('subsidiary principal is denied a different subsidiarys asset', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertFails(getDoc(doc(db, 'asset_library_items', ASSET_OTHER_SUB)));
  });

  test('anonymous / no-auth read is denied', async () => {
    const ctx = env.unauthenticatedContext();
    const db = ctx.firestore();
    await assertFails(getDoc(doc(db, 'asset_library_items', ASSET_OWN_SUB)));
  });
});

describe('asset_library_collections — subsidiary scoping', () => {
  test('subsidiary principal reads own subsidiary collection', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertSucceeds(
      getDoc(doc(db, 'asset_library_collections', COLLECTION_OWN_SUB)),
    );
  });

  test('different subsidiary cannot read', async () => {
    const ctx = env.authenticatedContext(OTHER_SUBSIDIARY_USER_UID, {
      email: 'labyrinth-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertFails(
      getDoc(doc(db, 'asset_library_collections', COLLECTION_OWN_SUB)),
    );
  });
});

describe('share_links — write-only from clients', () => {
  test('staff can create a share link with their own UID as createdBy', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertSucceeds(
      setDoc(doc(db, 'share_links', 'tok_new_one'), {
        token: 'tok_new_one',
        assetItemId: ASSET_OWN_SUB,
        createdBy: SUBSIDIARY_USER_UID,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
        allowDownload: true,
      }),
    );
  });

  test('staff cannot create a share link forged with another UID', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertFails(
      setDoc(doc(db, 'share_links', 'tok_forged'), {
        token: 'tok_forged',
        assetItemId: ASSET_OWN_SUB,
        createdBy: OTHER_SUBSIDIARY_USER_UID, // spoof
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
        allowDownload: true,
      }),
    );
  });

  test('share-link doc is unreadable from any client (even creator)', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertFails(getDoc(doc(db, 'share_links', SHARE_TOKEN)));
  });

  test('creator can revoke their own share link', async () => {
    const ctx = env.authenticatedContext(SUBSIDIARY_USER_UID, {
      email: 'subsidiary-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'share_links', SHARE_TOKEN), { revoked: true }),
    );
  });

  test('non-creator cannot revoke someone elses share link', async () => {
    const ctx = env.authenticatedContext(OTHER_SUBSIDIARY_USER_UID, {
      email: 'labyrinth-user@zeusgroup.test',
    });
    const db = ctx.firestore();
    await assertFails(
      updateDoc(doc(db, 'share_links', SHARE_TOKEN), { revoked: true }),
    );
  });
});
