/**
 * onDomainEventTaskGenerator — Phase 6.E trigger.
 *
 * Fires on every new domain_events doc, calls generateTasksForEvent,
 * and tags the event's `processedBy[]` with 'task-generator' for
 * at-least-once dispatch observability (mirrors the pattern the
 * existing phase-3b-stub consumer uses).
 *
 * Independent of the existing onDomainEventCreated consumer in
 * platform/outbox.js — both run in parallel; neither blocks the other.
 * If this trigger fails, the event is still marked processed by the
 * other consumer; rerun this trigger manually or via Cloud Scheduler
 * (deferred to 6.E.2 — backfill admin tool).
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { generateTasksForEvent } = require('./generateTasksForEvent');

const DOMAIN_EVENTS_COLLECTION = 'domain_events';

const onDomainEventTaskGenerator = onDocumentCreated(
  {
    document: `${DOMAIN_EVENTS_COLLECTION}/{eventId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;

    const businessEvent = {
      id: event.params.eventId,
      ...data,
    };

    const db = getFirestore();
    try {
      const { taskIds, matchedDefinitions } = await generateTasksForEvent({
        db, event: businessEvent, nowIso: new Date().toISOString(),
      });

      // eslint-disable-next-line no-console
      console.log(
        `[task-generator] event=${businessEvent.eventType}:${businessEvent.id} ` +
        `definitions=${matchedDefinitions} tasks=${taskIds.length}`,
      );

      await db.collection(DOMAIN_EVENTS_COLLECTION).doc(event.params.eventId).update({
        processedBy: FieldValue.arrayUnion('task-generator'),
        taskGeneratorRanAt: FieldValue.serverTimestamp(),
        taskGeneratorTaskCount: taskIds.length,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[task-generator] FAILED for event=${businessEvent.eventType}:${businessEvent.id}`,
        err,
      );
      // Don't rethrow — outbox processing must not block on this
      // consumer (rerun via backfill in 6.E.2).
    }
  },
);

module.exports = { onDomainEventTaskGenerator };
