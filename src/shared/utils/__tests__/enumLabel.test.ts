import { describe, it, expect } from 'vitest';
import { enumLabel, humanizeEnum, labelsFromTones } from '../enumLabel';

describe('humanizeEnum', () => {
  it.each([
    ['in_progress', 'In Progress'],
    ['in-progress', 'In Progress'],
    ['inProgress', 'In Progress'],
    ['revision_requested', 'Revision Requested'],
    ['IWO', 'IWO'],
    ['approved', 'Approved'],
  ])('%s → %s', (input, out) => expect(humanizeEnum(input)).toBe(out));
});

describe('enumLabel', () => {
  it('prefers the explicit map and humanises the rest', () => {
    const LABELS = { pending_client: 'Pending Client Approval' };
    expect(enumLabel('pending_client', LABELS)).toBe('Pending Client Approval');
    expect(enumLabel('pending_internal', LABELS)).toBe('Pending Internal');
  });
  it('never returns the raw slug or an empty string', () => {
    expect(enumLabel('', undefined)).toBe('—');
    expect(enumLabel(null, undefined, '')).toBe('');
    expect(enumLabel('media_buy')).not.toContain('_');
  });
  it('derives labels from a tone map', () => {
    expect(labelsFromTones({ on_hold: 'amber', done: 'green' })).toEqual({ on_hold: 'On Hold', done: 'Done' });
  });
});
