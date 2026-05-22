/**
 * IWO state machine — Node mirror of
 * `src/modules/assignment/constants/iwo-states.ts`.
 *
 * Cloud Functions can't `require()` TS sources, so the transition table is
 * duplicated here. KEEP IN SYNC. Spec §6.1 / §6.1.1 is the source of truth.
 *
 *   DRAFT → ISSUED → ACCEPTED → IN_PROGRESS → DELIVERED →
 *           ↘ REJECTED                       ↘ ACCEPTED_INTERNALLY → CLOSED
 *
 *   (any active) → CANCELLED  (AM authority)
 *   DELIVERED → IN_PROGRESS   (request_revision, AM only)
 */

const IWO_STATES = [
  'DRAFT',
  'ISSUED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'DELIVERED',
  'ACCEPTED_INTERNALLY',
  'CLOSED',
  'CANCELLED',
];

const IWO_EVENTS = [
  'issue',
  'accept',
  'reject',
  'start',
  'post_cost',
  'deliver',
  'accept_internal',
  'request_revision',
  'close',
  'cancel',
];

const IWO_TERMINAL_STATES = ['REJECTED', 'CLOSED', 'CANCELLED'];

const IWO_ACTIVE_STATES = [
  'ISSUED',
  'ACCEPTED',
  'IN_PROGRESS',
  'DELIVERED',
  'ACCEPTED_INTERNALLY',
];

/** Transition table — same shape as the TS spec source. */
const IWO_TRANSITIONS = [
  { event: 'issue',            from: 'DRAFT',                to: 'ISSUED' },
  { event: 'accept',           from: 'ISSUED',               to: 'ACCEPTED' },
  { event: 'reject',           from: 'ISSUED',               to: 'REJECTED' },
  { event: 'start',            from: 'ACCEPTED',             to: 'IN_PROGRESS' },
  { event: 'post_cost',        from: 'IN_PROGRESS',          to: 'IN_PROGRESS' },
  { event: 'deliver',          from: 'IN_PROGRESS',          to: 'DELIVERED' },
  { event: 'accept_internal',  from: 'DELIVERED',            to: 'ACCEPTED_INTERNALLY' },
  { event: 'request_revision', from: 'DELIVERED',            to: 'IN_PROGRESS' },
  { event: 'close',            from: 'ACCEPTED_INTERNALLY',  to: 'CLOSED' },
  // cancel — AM-only off-ramp from any active state
  ...['ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED_INTERNALLY'].map((from) => ({
    event: 'cancel',
    from,
    to: 'CANCELLED',
  })),
];

/** O(1) lookup: nextState(from, event) → toState or undefined. */
const IWO_TRANSITION_LOOKUP = IWO_TRANSITIONS.reduce((acc, t) => {
  if (!acc[t.from]) acc[t.from] = {};
  acc[t.from][t.event] = t.to;
  return acc;
}, {});

/**
 * Pure guard helper. Returns the target state for a transition, or throws
 * a HandlerError with `code: 'INVALID_STATE_TRANSITION'` if illegal.
 *
 * Throws plain Error (not HttpsError) so the pure logic stays
 * environment-agnostic and unit-testable without firebase-functions. The
 * call site wraps it.
 */
function nextState(from, event) {
  const next = IWO_TRANSITION_LOOKUP[from] && IWO_TRANSITION_LOOKUP[from][event];
  if (!next) {
    const err = new Error(`INVALID_STATE_TRANSITION: ${event} not allowed from ${from}`);
    err.code = 'INVALID_STATE_TRANSITION';
    err.from = from;
    err.event = event;
    throw err;
  }
  return next;
}

function isTerminal(state) {
  return IWO_TERMINAL_STATES.indexOf(state) !== -1;
}

function isActive(state) {
  return IWO_ACTIVE_STATES.indexOf(state) !== -1;
}

const BUDGET_HOLD_STATES = ['HELD', 'LOCKED', 'SETTLED', 'RELEASED'];

module.exports = {
  IWO_STATES,
  IWO_EVENTS,
  IWO_TRANSITIONS,
  IWO_TRANSITION_LOOKUP,
  IWO_TERMINAL_STATES,
  IWO_ACTIVE_STATES,
  BUDGET_HOLD_STATES,
  nextState,
  isTerminal,
  isActive,
};
