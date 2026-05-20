import { describe, it, expect } from 'vitest';
import { getPinAutoReleaseReason } from '../projectPinMilestones';
import type { DesignProject } from '../../types';

describe('getPinAutoReleaseReason', () => {
  const emptySo = new Set<string>();

  it('releases when project missing', () => {
    expect(
      getPinAutoReleaseReason(undefined, [], null, 'none', emptySo, true),
    ).toBe('Project removed from your list');
  });

  it('releases when deal won', () => {
    const p = { id: '1' } as DesignProject;
    expect(
      getPinAutoReleaseReason(p, [], 'won', 'none', emptySo, true),
    ).toBe('CRM deal won');
  });

  it('releases when SO linked on project', () => {
    const p = { id: '1', linkedSalesOrderId: 'so1' } as DesignProject;
    expect(
      getPinAutoReleaseReason(p, [], 'quotation', 'none', emptySo, true),
    ).toBe('Sales order linked');
  });

  it('releases when SO exists only on salesOrders collection', () => {
    const p = { id: '1' } as DesignProject;
    expect(
      getPinAutoReleaseReason(p, [], 'quotation', 'none', new Set(['1']), true),
    ).toBe('Sales order linked');
  });

  it('releases when quote has partial line approval and commercial ready', () => {
    const p = { id: '1' } as DesignProject;
    expect(
      getPinAutoReleaseReason(p, [], 'quotation', 'partial_lines', emptySo, true),
    ).toBe('Client quote has approved line(s)');
  });

  it('does not release on partial_lines until commercial ready', () => {
    const p = { id: '1' } as DesignProject;
    expect(
      getPinAutoReleaseReason(p, [], 'quotation', 'partial_lines', emptySo, false),
    ).toBeNull();
  });

  it('keeps pin when still early', () => {
    const p = { id: '1' } as DesignProject;
    expect(
      getPinAutoReleaseReason(p, [], 'quotation', 'draft', emptySo, true),
    ).toBeNull();
  });
});
