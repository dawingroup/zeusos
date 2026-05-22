/**
 * routeDirectClientRequest — spec §7.4 Layer 3.
 *
 *   cd functions && node --test __tests__/assignment/route-direct-client-request.test.js
 *
 * Behavior verified:
 *   - Subsidiary actor with valid input writes an intake doc + emits
 *     `DirectClientRequestRouted` to the outbox in one txn.
 *   - `masterJobId` omitted → intake lands under `intake_unassigned/`.
 *   - Missing required fields → invalid-argument.
 *   - Unauthenticated → unauthenticated.
 *   - Idempotency key replays return the cached intakeId without
 *     writing a second intake doc.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore, patchAuthForTests, auth } = require('./_seed-helpers');

patchAuthForTests();

// Override loadUserDoc to a passthrough so we don't need to seed user docs.
const authLib = require('../../src/assignment/lib/auth');
authLib.loadUserDoc = async (uid) => ({ id: uid, homeOrgId: 'zeus-the-agency' });

const { runRouteDirectClientRequest } =
  require('../../src/assignment/routeDirectClientRequest');

function intakeDocs(db) {
  return db._dump_prefix
    ? [
        ...db._dump_prefix('intake_unassigned'),
        // Master-job intake docs live under master_jobs/{id}/intake/{intakeId};
        // dump every doc whose path matches that shape.
        ...Object.keys(db._raw ? db._raw() : {}).filter(() => false),
      ]
    : [];
}

test('happy path — writes intake under master_jobs/{id}/intake + emits event', async () => {
  const { db } = makeFirestore();

  const result = await runRouteDirectClientRequest({
    db,
    auth: auth.dl,
    data: {
      receivingSubsidiaryOrgId: 'zeus-the-agency',
      routedToUserId: 'user_am_001',
      masterJobId: 'mj_test_1',
      clientId: 'client_smirnoff',
      note: 'Client called wanting an extra KV by Friday.',
      idempotencyKey: 'idem_route_001',
    },
  });

  assert.ok(result.intakeId.startsWith('intake_'));

  // The intake doc lives under master_jobs/{id}/intake/{intakeId}.
  const intakeRows = db._dump_prefix('master_jobs/mj_test_1/intake');
  assert.equal(intakeRows.length, 1);
  const intake = intakeRows[0].data;
  assert.equal(intake.source, 'DIRECT_CLIENT_REQUEST');
  assert.equal(intake.receivingSubsidiaryOrgId, 'zeus-the-agency');
  assert.equal(intake.routedToUserId, 'user_am_001');
  assert.equal(intake.routedByUserId, auth.dl.uid);
  assert.equal(intake.clientId, 'client_smirnoff');
  assert.equal(intake.masterJobId, 'mj_test_1');
  assert.equal(intake.status, 'PENDING_AM_REVIEW');

  // The domain event was appended.
  const events = db._dump_prefix('domain_events');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.eventType, 'DirectClientRequestRouted');
  assert.equal(events[0].data.aggregateId, 'mj_test_1');
  assert.equal(events[0].data.payload.note, 'Client called wanting an extra KV by Friday.');
});

test('omitting masterJobId lands intake under intake_unassigned/', async () => {
  const { db } = makeFirestore();

  const result = await runRouteDirectClientRequest({
    db,
    auth: auth.dl,
    data: {
      receivingSubsidiaryOrgId: 'zeus-the-agency',
      routedToUserId: 'user_am_001',
      clientId: 'client_new_lead',
      note: 'Cold call — wants a media plan.',
      idempotencyKey: 'idem_route_002',
    },
  });

  assert.ok(result.intakeId);
  const intakes = db._dump_prefix('intake_unassigned');
  assert.equal(intakes.length, 1);
  assert.equal(intakes[0].data.masterJobId, null);
  // Aggregate id falls back to clientId when masterJobId absent.
  const events = db._dump_prefix('domain_events');
  assert.equal(events[0].data.aggregateId, 'client_new_lead');
});

test('missing note → invalid-argument', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    runRouteDirectClientRequest({
      db,
      auth: auth.dl,
      data: {
        receivingSubsidiaryOrgId: 'zeus-the-agency',
        routedToUserId: 'user_am_001',
        clientId: 'client_x',
        note: '   ',
      },
    }),
    (err) => /note is required/.test(err.message || String(err)),
  );
});

test('missing clientId → invalid-argument', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    runRouteDirectClientRequest({
      db,
      auth: auth.dl,
      data: {
        receivingSubsidiaryOrgId: 'zeus-the-agency',
        routedToUserId: 'user_am_001',
        note: 'hi',
      },
    }),
    (err) => /clientId is required/.test(err.message || String(err)),
  );
});

test('unauthenticated → unauthenticated', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    runRouteDirectClientRequest({
      db,
      auth: null,
      data: {
        receivingSubsidiaryOrgId: 'zeus-the-agency',
        routedToUserId: 'user_am_001',
        clientId: 'client_x',
        note: 'hi',
      },
    }),
    (err) => /Authentication required/.test(err.message || String(err)),
  );
});

test('idempotency replay returns cached intakeId without new intake doc', async () => {
  const { db } = makeFirestore();

  const args = {
    db,
    auth: auth.dl,
    data: {
      receivingSubsidiaryOrgId: 'zeus-the-agency',
      routedToUserId: 'user_am_001',
      masterJobId: 'mj_test_2',
      clientId: 'client_smirnoff',
      note: 'follow-up note',
      idempotencyKey: 'idem_route_replay_003',
    },
  };
  const first = await runRouteDirectClientRequest(args);
  const second = await runRouteDirectClientRequest(args);

  assert.equal(first.intakeId, second.intakeId);

  // Only one intake doc — the replay did not duplicate.
  const intakeRows = db._dump_prefix('master_jobs/mj_test_2/intake');
  assert.equal(intakeRows.length, 1);

  // Only one domain event too.
  const events = db._dump_prefix('domain_events');
  assert.equal(events.length, 1);
});
