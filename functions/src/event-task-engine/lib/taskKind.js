/**
 * Derives a task `kind` from a domain event type when the rule does not
 * declare one. Kinds decide the buttons a card shows: approval → Approve /
 * Reject, review → Reviewed, action → Start / Mark done, followup → Done /
 * Snooze, notify → Acknowledge. PURE.
 */

const APPROVAL = [/approval/i, /approve/i, /signoff/i];
const REVIEW = [/review/i, /audit/i, /verify/i, /riskraised|risk$/i, /conflict/i, /proposed/i];
const FOLLOWUP = [/followup/i, /reminder/i, /nudge/i, /received/i];
const NOTIFY = [/notice$/i, /fyi/i, /generated$/i, /posted$/i, /sent$/i, /refused$/i];

function deriveKind(eventType) {
  if (typeof eventType !== 'string' || !eventType) return 'action';
  if (APPROVAL.some((re) => re.test(eventType))) return 'approval';
  if (FOLLOWUP.some((re) => re.test(eventType))) return 'followup';
  if (REVIEW.some((re) => re.test(eventType))) return 'review';
  if (NOTIFY.some((re) => re.test(eventType))) return 'notify';
  return 'action';
}

/** The rule's explicit kind wins; else derived from the event type. */
function resolveKind(rule, eventType) {
  const explicit = rule && typeof rule.kind === 'string' ? rule.kind : null;
  return explicit || deriveKind(eventType);
}

module.exports = { deriveKind, resolveKind };
