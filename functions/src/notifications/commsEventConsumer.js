/**
 * Comms notification fan-out — Phase 4.4.
 *
 * A second consumer on the domain-events outbox (alongside onDomainEventCreated):
 * when a `ClientMessageReceived` event lands, resolve who should be alerted and
 * web-push them, then tag the event `processedBy: arrayUnion('comms-notify')`
 * so dispatch is at-least-once + idempotent.
 *
 * Recipient resolution (most specific first):
 *   1. the conversation's `assignedTo` (whoever owns the thread), else
 *   2. the linked client's `relationshipManagerUserId`.
 * No recipient → nothing to do (we still tag the event so it isn't reprocessed).
 *
 * This same event stream is what the planned Phase 6.E uniform inbox consumes —
 * the payload stays channel-agnostic.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROCESSED_TAG = 'comms-notify';

/**
 * Resolve the uids to notify for a ClientMessageReceived payload.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} payload — { conversationId, clientId, ... }
 * @returns {Promise<string[]>}
 */
async function resolveRecipients(db, payload) {
  const out = new Set();
  if (payload && payload.conversationId) {
    try {
      const convSnap = await db.doc(`whatsappConversations/${payload.conversationId}`).get();
      if (convSnap.exists && convSnap.data().assignedTo) out.add(convSnap.data().assignedTo);
    } catch (_) { /* best-effort */ }
  }
  if (out.size === 0 && payload && payload.clientId) {
    try {
      const clientSnap = await db.doc(`clients/${payload.clientId}`).get();
      if (clientSnap.exists && clientSnap.data().relationshipManagerUserId) {
        out.add(clientSnap.data().relationshipManagerUserId);
      }
    } catch (_) { /* best-effort */ }
  }
  return [...out];
}

function buildPayload(eventPayload) {
  const who = eventPayload.customerName || eventPayload.phoneNumber || 'A client';
  const channel = eventPayload.channel || 'message';
  return {
    title: `New ${channel} message`,
    body: eventPayload.textPreview
      ? `${who}: ${eventPayload.textPreview}`
      : `${who} sent a message`,
    data: {
      url: eventPayload.conversationId ? `/comms?conversation=${eventPayload.conversationId}` : '/comms',
      channel,
    },
  };
}

/** Core handler — exported for unit testing. */
async function handleCommsEvent(db, eventId, data) {
  if (!data || data.eventType !== 'ClientMessageReceived') return;
  // Idempotency — skip if this consumer already processed the event.
  if (Array.isArray(data.processedBy) && data.processedBy.includes(PROCESSED_TAG)) return;

  const payload = data.payload || {};
  const recipients = await resolveRecipients(db, payload);

  if (recipients.length > 0) {
    // Lazy-require keeps web-push off the module-load path (test-friendly).
    const { sendPushToUser } = require('./pushNotifications');
    const pushPayload = buildPayload(payload);
    await Promise.all(
      recipients.map((uid) =>
        sendPushToUser(uid, pushPayload).catch((err) =>
          logger.warn(`[comms-notify] push to ${uid} failed: ${err.message}`),
        ),
      ),
    );
  }

  await db.doc(`domain_events/${eventId}`).update({
    processedBy: FieldValue.arrayUnion(PROCESSED_TAG),
    notifyProcessedAt: FieldValue.serverTimestamp(),
  });
}

exports.onCommsEventNotify = onDocumentCreated(
  { document: 'domain_events/{eventId}', region: 'europe-west1' },
  async (event) => {
    const data = event.data && event.data.data();
    try {
      await handleCommsEvent(getFirestore(), event.params.eventId, data);
    } catch (err) {
      logger.error('[comms-notify] handler error', { error: err.message });
    }
  },
);

exports._internals = { resolveRecipients, buildPayload, handleCommsEvent, PROCESSED_TAG };
