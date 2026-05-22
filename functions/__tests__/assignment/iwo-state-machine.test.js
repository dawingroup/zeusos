/**
 * IWO state-machine table tests — spec §6.1.1 (transition table) is the
 * source of truth. Run:
 *   cd functions && node --test __tests__/assignment/iwo-state-machine.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IWO_STATES,
  IWO_EVENTS,
  IWO_TERMINAL_STATES,
  IWO_ACTIVE_STATES,
  nextState,
  isTerminal,
  isActive,
} = require('../../src/assignment/lib/iwo-state-machine');

test('every state and event referenced is known', () => {
  for (const s of ['DRAFT','ISSUED','ACCEPTED','REJECTED','IN_PROGRESS','DELIVERED','ACCEPTED_INTERNALLY','CLOSED','CANCELLED']) {
    assert.ok(IWO_STATES.includes(s), `state ${s} missing`);
  }
  for (const e of ['issue','accept','reject','start','post_cost','deliver','accept_internal','request_revision','close','cancel']) {
    assert.ok(IWO_EVENTS.includes(e), `event ${e} missing`);
  }
});

test('happy-path: DRAFT → ISSUED → ACCEPTED → IN_PROGRESS → DELIVERED → ACCEPTED_INTERNALLY → CLOSED', () => {
  assert.equal(nextState('DRAFT', 'issue'), 'ISSUED');
  assert.equal(nextState('ISSUED', 'accept'), 'ACCEPTED');
  assert.equal(nextState('ACCEPTED', 'start'), 'IN_PROGRESS');
  assert.equal(nextState('IN_PROGRESS', 'deliver'), 'DELIVERED');
  assert.equal(nextState('DELIVERED', 'accept_internal'), 'ACCEPTED_INTERNALLY');
  assert.equal(nextState('ACCEPTED_INTERNALLY', 'close'), 'CLOSED');
});

test('rejection: ISSUED → REJECTED', () => {
  assert.equal(nextState('ISSUED', 'reject'), 'REJECTED');
});

test('request_revision sends DELIVERED back to IN_PROGRESS (§11.10)', () => {
  assert.equal(nextState('DELIVERED', 'request_revision'), 'IN_PROGRESS');
});

test('post_cost is a self-loop on IN_PROGRESS', () => {
  assert.equal(nextState('IN_PROGRESS', 'post_cost'), 'IN_PROGRESS');
});

test('cancel is permitted from every active state', () => {
  for (const s of IWO_ACTIVE_STATES) {
    assert.equal(nextState(s, 'cancel'), 'CANCELLED', `cancel from ${s}`);
  }
});

test('cancel is NOT permitted from terminal states', () => {
  for (const s of IWO_TERMINAL_STATES) {
    assert.throws(() => nextState(s, 'cancel'), /INVALID_STATE_TRANSITION/);
  }
});

test('cancel is NOT permitted from DRAFT (not active yet)', () => {
  assert.throws(() => nextState('DRAFT', 'cancel'), /INVALID_STATE_TRANSITION/);
});

test('illegal events bounce: cannot issue from ACCEPTED, deliver from DRAFT, etc.', () => {
  assert.throws(() => nextState('ACCEPTED', 'issue'), /INVALID_STATE_TRANSITION/);
  assert.throws(() => nextState('DRAFT', 'deliver'), /INVALID_STATE_TRANSITION/);
  assert.throws(() => nextState('CLOSED', 'reject'), /INVALID_STATE_TRANSITION/);
});

test('isTerminal / isActive predicates', () => {
  assert.ok(isTerminal('CLOSED'));
  assert.ok(isTerminal('REJECTED'));
  assert.ok(isTerminal('CANCELLED'));
  assert.ok(!isTerminal('IN_PROGRESS'));
  assert.ok(isActive('IN_PROGRESS'));
  assert.ok(!isActive('DRAFT'));
  assert.ok(!isActive('CLOSED'));
});
