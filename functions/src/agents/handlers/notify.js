/**
 * Notify handlers (ZeusOS). Each writes a `notifications` row tagged with the
 * routing audience. Notifications are allowed for draft_only agents (no live
 * business-data mutation), so this is the safest action surface.
 */
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function writeNotification(input, context, audience) {
  const ref = db.collection('notifications').doc();
  await ref.set({
    id: ref.id,
    audience, // 'user' | 'team' | 'subsidiary_lead' | 'escalate'
    title: input.title,
    body: input.body || null,
    priority: input.priority || 'medium',
    targetUserId: input.targetUserId || null,
    targetBrandId: input.targetBrandId || null,
    sourceModule: input.sourceModule || 'agents',
    sourceAgentId: context.agentId,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    actionUrl: input.actionUrl || null,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { result: { id: ref.id }, summary: `Notified (${audience}): ${input.title}` };
}

module.exports = {
  handleNotifyUser: (i, c) => writeNotification(i, c, 'user'),
  handleNotifyTeam: (i, c) => writeNotification(i, c, 'team'),
  handleNotifySubsidiaryLead: (i, c) => writeNotification(i, c, 'subsidiary_lead'),
  handleNotifyEscalate: (i, c) => writeNotification(i, c, 'escalate'),
};
