/**
 * The overdue escalation ladder on the P-scale, plus the max of two priorities.
 * PURE.
 */
const { normalisePriority } = require('./taskModel');

const ESCALATE_TO = Object.freeze({ P3: 'P2', P2: 'P1', P1: 'P0', P0: 'P0' });
const DEESCALATE_TO = Object.freeze({ P2: 'P3', P1: 'P2', P0: 'P1' });
const PRIORITY_RANK = Object.freeze({ P0: 4, P1: 3, P2: 2, P3: 1 });

/** Working hours past due before a task escalates, by priority. */
const ESCALATION_AFTER_WORKING_HOURS = Object.freeze({ P0: 1, P1: 4, P2: 9, P3: 27 });

function escalatedPriority(priority) {
  return ESCALATE_TO[normalisePriority(priority)];
}

/**
 * Priority to restore when an unowned task finally gets an owner: its
 * escalation bumped the priority while reaching nobody, so the bump is undone.
 * Approval tasks keep the floor of P1. Null when there is nothing to undo.
 */
function deescalatedPriority(task) {
  if (!task || !task.escalatedAt) return null;
  const lower = DEESCALATE_TO[normalisePriority(task.priority)];
  if (!lower) return null;
  if (task.kind === 'approval' && (lower === 'P2' || lower === 'P3')) return 'P1';
  return lower;
}

/** The higher of two priorities. Ties keep `a`. */
function priorityMax(a, b) {
  return PRIORITY_RANK[normalisePriority(a)] >= PRIORITY_RANK[normalisePriority(b)] ? normalisePriority(a) : normalisePriority(b);
}

module.exports = { ESCALATE_TO, PRIORITY_RANK, ESCALATION_AFTER_WORKING_HOURS, escalatedPriority, deescalatedPriority, priorityMax };
