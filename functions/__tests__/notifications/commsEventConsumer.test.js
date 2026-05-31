/**
 * commsEventConsumer — comms notification fan-out (Phase 4.4).
 *
 * Run: cd functions && node --test __tests__/notifications/commsEventConsumer.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const stub = require('../assignment/_firestore-stub');

// Capture push calls + mock the lazy-required pushNotifications module.
let _pushCalls = [];
let _db;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return { getFirestore: () => _db, FieldValue: stub.FieldValueStub };
  }
  if (request === 'firebase-functions/v2/firestore') {
    return { onDocumentCreated: (_cfg, handler) => handler };
  }
  if (request === 'firebase-functions') {
    return { logger: { info() {}, warn() {}, error() {} } };
  }
  if (request === './pushNotifications') {
    return { sendPushToUser: async (uid, payload) => { _pushCalls.push({ uid, payload }); return { success: true }; } };
  }
  return origLoad.call(this, request, ...rest);
};

const consumer = require('../../src/notifications/commsEventConsumer');
const { handleCommsEvent, PROCESSED_TAG } = consumer._internals;

function freshDb() {
  const { db } = stub.makeFirestore();
  _db = db;
  _pushCalls = [];
  return db;
}

function seedEvent(db, id, payload, processedBy = []) {
  db._seed(`domain_events/${id}`, { eventType: 'ClientMessageReceived', payload, processedBy });
}

test('pushes to the conversation assignee + tags the event', async () => {
  const db = freshDb();
  db._seed('whatsappConversations/conv1', { assignedTo: 'u_alice', clientId: 'acme' });
  seedEvent(db, 'ev1', { conversationId: 'conv1', customerName: 'Bob', textPreview: 'hello', clientId: 'acme' });

  await handleCommsEvent(db, 'ev1', db._dump()['domain_events/ev1']);

  assert.equal(_pushCalls.length, 1);
  assert.equal(_pushCalls[0].uid, 'u_alice');
  assert.match(_pushCalls[0].payload.body, /Bob: hello/);
  // Event tagged for at-least-once idempotency.
  assert.ok(db._dump()['domain_events/ev1'].processedBy.includes(PROCESSED_TAG));
});

test('falls back to the client relationship manager when no assignee', async () => {
  const db = freshDb();
  db._seed('whatsappConversations/conv2', { clientId: 'globex' }); // no assignedTo
  db._seed('clients/globex', { relationshipManagerUserId: 'u_rm' });
  seedEvent(db, 'ev2', { conversationId: 'conv2', clientId: 'globex', textPreview: 'hi' });

  await handleCommsEvent(db, 'ev2', db._dump()['domain_events/ev2']);
  assert.equal(_pushCalls.length, 1);
  assert.equal(_pushCalls[0].uid, 'u_rm');
});

test('no recipient → no push, but still tags the event', async () => {
  const db = freshDb();
  db._seed('whatsappConversations/conv3', {}); // no assignee, no client
  seedEvent(db, 'ev3', { conversationId: 'conv3' });

  await handleCommsEvent(db, 'ev3', db._dump()['domain_events/ev3']);
  assert.equal(_pushCalls.length, 0);
  assert.ok(db._dump()['domain_events/ev3'].processedBy.includes(PROCESSED_TAG));
});

test('idempotent — already-tagged event is skipped', async () => {
  const db = freshDb();
  db._seed('whatsappConversations/conv4', { assignedTo: 'u_alice' });
  seedEvent(db, 'ev4', { conversationId: 'conv4', textPreview: 'x' }, [PROCESSED_TAG]);

  await handleCommsEvent(db, 'ev4', db._dump()['domain_events/ev4']);
  assert.equal(_pushCalls.length, 0);
});

test('ignores non-ClientMessageReceived events', async () => {
  const db = freshDb();
  await handleCommsEvent(db, 'evX', { eventType: 'IWOIssued', payload: {} });
  assert.equal(_pushCalls.length, 0);
});
