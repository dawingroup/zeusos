/**
 * withTimeout — a fast promise passes through untouched, a hung promise (the
 * Firestore-write-never-acks case) rejects with a TimeoutError instead of
 * blocking forever, and a real rejection is surfaced verbatim.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, TimeoutError, DEFAULT_WRITE_TIMEOUT_MS } from '../withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the value when the promise settles before the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 'Save', 1000)).resolves.toBe('ok');
  });

  it('rejects with a TimeoutError when the promise never settles', async () => {
    const guarded = withTimeout(new Promise<string>(() => {}), 'Save client', 5000);
    const assertion = expect(guarded).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('includes the label in the timeout message', async () => {
    const guarded = withTimeout(new Promise<string>(() => {}), 'Update rate card', 3000);
    const assertion = expect(guarded).rejects.toThrow(/Update rate card/);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });

  it('propagates a real rejection rather than masking it as a timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('permission-denied')), 'Save', 1000)).rejects.toThrow('permission-denied');
  });

  it('defaults to DEFAULT_WRITE_TIMEOUT_MS when no deadline is given', async () => {
    const guarded = withTimeout(new Promise<string>(() => {}), 'Save');
    const assertion = expect(guarded).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(DEFAULT_WRITE_TIMEOUT_MS);
    await assertion;
  });
});
