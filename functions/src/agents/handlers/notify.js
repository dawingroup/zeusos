/**
 * Notify handlers (ZeusOS). Each resolves its audience to PEOPLE and writes
 * one canonical notice per person through lib/noticeDelivery.js (stream C) —
 * `userId`, `organizationId`, `isRead`, `actionUrl` — so the bell shows it.
 *
 * Before 2026-10-29 these wrote `{ audience, targetUserId, body }` with no
 * `userId` and no `organizationId`: the client listener filters on both, so
 * every agent notice was written and never seen.
 *
 * Notifications are allowed for draft_only agents (no live business-data
 * mutation), so this is the safest action surface.
 */
const admin = require('firebase-admin');
const { notifyAudience } = require('../../lib/noticeDelivery');

if (!admin.apps.length) admin.initializeApp();

function audienceFor(kind, input) {
  switch (kind) {
    case 'user': return { kind: 'user', uid: input.targetUserId || undefined, personKey: input.targetUserId || undefined };
    case 'team': return { kind: 'brand_staff', subsidiaryId: input.targetBrandId || null };
    case 'subsidiary_lead': return { kind: 'brand_leads', subsidiaryId: input.targetBrandId || null };
    case 'escalate': return { kind: 'parent_org' };
    default: return { kind: kind };
  }
}

async function writeNotification(input, context, kind, deps = {}) {
  const db = deps.db || admin.firestore();
  const audience = audienceFor(kind, input || {});
  const result = await notifyAudience(db, {
    audience,
    type: input.type || `agent.${kind}`,
    title: input.title,
    message: input.body || input.message || '',
    module: input.module || input.sourceModule || 'agents',
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    actionUrl: input.actionUrl || null,
    priority: input.priority || 'medium',
    source: `agent:${(context && context.agentId) || 'unknown'}`,
    dedupeKey: input.dedupeKey || undefined,
    metadata: { agentId: (context && context.agentId) || null, audience: kind, targetBrandId: input.targetBrandId || null },
  }, deps);
  return {
    result: { recipients: result.recipients, written: result.written, fellBack: result.fellBack },
    summary: `Notified ${result.written} ${result.written === 1 ? 'person' : 'people'} (${kind}${result.fellBack ? ', fell back to the owners' : ''}): ${input.title}`,
  };
}

module.exports = {
  handleNotifyUser: (i, c, d) => writeNotification(i, c, 'user', d),
  handleNotifyTeam: (i, c, d) => writeNotification(i, c, 'team', d),
  handleNotifySubsidiaryLead: (i, c, d) => writeNotification(i, c, 'subsidiary_lead', d),
  handleNotifyEscalate: (i, c, d) => writeNotification(i, c, 'escalate', d),
  writeNotification,
  audienceFor,
};
