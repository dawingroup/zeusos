/**
 * A dropped connection during a callable showed a toast reading "internal".
 * The Firebase SDK reports a request that never arrived as code `internal`,
 * message "internal" — indistinguishable, on screen, from nothing at all.
 */
import { describe, it, expect } from 'vitest';
import { describeCallableError, isNoAnswerError } from '../callableError';

const sdk = (code: string, message = code) => Object.assign(new Error(message), { code: `functions/${code}` });

describe('isNoAnswerError', () => {
  it('a request that never arrived', () => {
    expect(isNoAnswerError(sdk('internal'))).toBe(true);
    expect(isNoAnswerError(sdk('unavailable'))).toBe(true);
    expect(isNoAnswerError(sdk('deadline-exceeded', 'deadline-exceeded'))).toBe(true);
    expect(isNoAnswerError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNoAnswerError(Object.assign(new Error('INTERNAL'), { code: 'internal' }))).toBe(true);
  });

  it('a refusal that says why is not one', () => {
    expect(isNoAnswerError(sdk('failed-precondition', 'This IWO is already accepted.'))).toBe(false);
    expect(isNoAnswerError(sdk('permission-denied', 'Only a parent-org principal can issue an IWO.'))).toBe(false);
    expect(isNoAnswerError(sdk('internal', 'Meta refused the template: too long'))).toBe(false);
    expect(isNoAnswerError(new Error('That quote no longer exists.'))).toBe(false);
  });

  it('nothing at all is not mistaken for a network failure', () => {
    expect(isNoAnswerError(undefined)).toBe(false);
    expect(isNoAnswerError(new Error(''))).toBe(false);
  });
});

describe('describeCallableError', () => {
  it('says the server could not be reached and what did not happen', () => {
    expect(describeCallableError(sdk('internal'), 'issue the IWO', true))
      .toBe("Couldn't reach the server to issue the IWO. Check your connection and try again.");
  });

  it('says so plainly when the browser is offline', () => {
    expect(describeCallableError(sdk('internal'), 'approve the quote', false))
      .toBe("You're offline, so we couldn't approve the quote. Reconnect and try again.");
  });

  it('never shows the bare word "internal"', () => {
    for (const online of [true, false]) {
      expect(describeCallableError(sdk('internal'), 'issue the IWO', online)).not.toMatch(/^internal$/i);
    }
  });

  it("a refusal is shown in the server's own words", () => {
    expect(describeCallableError(sdk('failed-precondition', 'Accept the IWO before posting time to it.'), 'post time', true))
      .toBe('Accept the IWO before posting time to it.');
  });

  it('an error with no words at all still says what failed', () => {
    expect(describeCallableError(new Error(''), 'withdraw that version', true)).toBe("Couldn't withdraw that version. Try again.");
    expect(describeCallableError(null, 'withdraw that version', true)).toBe("Couldn't withdraw that version. Try again.");
  });
});
