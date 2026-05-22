/**
 * Phase 3.E — Firestore rules tests for cross-subsidiary IWO isolation.
 *
 * Spec §7.4 Layer 1 (authorization) demands that a subsidiary user can
 * only read IWOs whose `subsidiaryOrgId` equals their own home org.
 * `internal_work_orders` is a two-sided collection (AM reads everything;
 * sub-brand reads only its own) and the cost-entry / time-entry / etc.
 * subcollections inherit visibility from the parent.
 *
 * These tests use `.describe.skip` until the emulator is wired into CI.
 * To run locally:
 *   firebase emulators:exec --only firestore "vitest run tests/firestore.rules.delivery.test.ts"
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

let testEnv: RulesTestEnvironment;

// The emulator may not be running in every checkout — keep the suite
// behind .skip until 3.G turns on a CI emulator runner.
describe.skip('Phase 3.E — IWO cross-subsidiary rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'zeusos-rules-test',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  async function seedOrg(orgId: string, kind: 'PARENT' | 'SUBSIDIARY') {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `organizations/${orgId}`), {
        id: orgId,
        name: orgId,
        kind,
        is_legal_entity: true,
        base_currency: 'UGX',
        gl_connection_id: null,
      });
    });
  }

  async function seedSubsidiaryUser(uid: string, homeOrgId: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${uid}`), {
        homeOrgId,
        globalRole: 'member',
      });
    });
  }

  async function seedIwo(iwoId: string, subsidiaryOrgId: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `internal_work_orders/${iwoId}`), {
        id: iwoId,
        subsidiaryOrgId,
        state: 'ISSUED',
        budgetMinor: 1_000_00,
        currency: 'UGX',
      });
      await setDoc(
        doc(ctx.firestore(), `internal_work_orders/${iwoId}/cost_entries/ce1`),
        { id: 'ce1', amountMinor: 100_00, kind: 'VENDOR' },
      );
      await setDoc(
        doc(ctx.firestore(), `internal_work_orders/${iwoId}/time_entries/te1`),
        { id: 'te1', minutes: 60, costMinor: 100_00 },
      );
    });
  }

  test('subsidiary user CAN read their own IWO', async () => {
    await seedOrg('zeus-the-agency', 'SUBSIDIARY');
    await seedSubsidiaryUser('zta-user', 'zeus-the-agency');
    await seedIwo('iwo-zta-1', 'zeus-the-agency');
    const db = testEnv.authenticatedContext('zta-user').firestore();
    await assertSucceeds(getDoc(doc(db, 'internal_work_orders/iwo-zta-1')));
  });

  test('subsidiary user CANNOT read another subsidiary\'s IWO', async () => {
    await seedOrg('zeus-the-agency', 'SUBSIDIARY');
    await seedOrg('labyrinth', 'SUBSIDIARY');
    await seedSubsidiaryUser('zta-user', 'zeus-the-agency');
    await seedIwo('iwo-lab-1', 'labyrinth');
    const db = testEnv.authenticatedContext('zta-user').firestore();
    await assertFails(getDoc(doc(db, 'internal_work_orders/iwo-lab-1')));
  });

  test('subsidiary user CANNOT read another sub\'s cost entries', async () => {
    await seedOrg('zeus-the-agency', 'SUBSIDIARY');
    await seedOrg('labyrinth', 'SUBSIDIARY');
    await seedSubsidiaryUser('zta-user', 'zeus-the-agency');
    await seedIwo('iwo-lab-1', 'labyrinth');
    const db = testEnv.authenticatedContext('zta-user').firestore();
    await assertFails(getDoc(doc(db, 'internal_work_orders/iwo-lab-1/cost_entries/ce1')));
  });

  test('subsidiary user CANNOT read another sub\'s time entries', async () => {
    await seedOrg('zeus-the-agency', 'SUBSIDIARY');
    await seedOrg('labyrinth', 'SUBSIDIARY');
    await seedSubsidiaryUser('zta-user', 'zeus-the-agency');
    await seedIwo('iwo-lab-1', 'labyrinth');
    const db = testEnv.authenticatedContext('zta-user').firestore();
    await assertFails(getDoc(doc(db, 'internal_work_orders/iwo-lab-1/time_entries/te1')));
  });

  test('subsidiary user CAN read their own cost + time entries', async () => {
    await seedOrg('zeus-the-agency', 'SUBSIDIARY');
    await seedSubsidiaryUser('zta-user', 'zeus-the-agency');
    await seedIwo('iwo-zta-1', 'zeus-the-agency');
    const db = testEnv.authenticatedContext('zta-user').firestore();
    await assertSucceeds(getDoc(doc(db, 'internal_work_orders/iwo-zta-1/cost_entries/ce1')));
    await assertSucceeds(getDoc(doc(db, 'internal_work_orders/iwo-zta-1/time_entries/te1')));
  });

  test('client SDK cannot write IWOs — transitions go via Cloud Functions', async () => {
    await seedOrg('zeus-the-agency', 'SUBSIDIARY');
    await seedSubsidiaryUser('zta-user', 'zeus-the-agency');
    const db = testEnv.authenticatedContext('zta-user').firestore();
    await assertFails(
      setDoc(doc(db, 'internal_work_orders/iwo-new'), {
        subsidiaryOrgId: 'zeus-the-agency',
        state: 'ISSUED',
      }),
    );
  });
});
