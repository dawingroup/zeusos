/**
 * ApprovalChainTimeline tests — Phase 6.UI.D.2.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApprovalChainTimeline } from '../components/ApprovalChainTimeline';
import type { ApprovalChain } from '@/modules/assignment/types/approval-chain.types';

function chain(overrides: Partial<ApprovalChain> = {}): ApprovalChain {
  return {
    ladder: ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD'],
    currentRung: 'ACD',
    complete: false,
    history: [
      { sequenceNumber: 1, rung: 'DESIGNER',   action: 'INIT',    actorUserId: 'u1', occurredAt: '2026-05-01T00:00:00Z' },
      { sequenceNumber: 2, rung: 'AD',         action: 'ADVANCE', actorUserId: 'u2', occurredAt: '2026-05-02T00:00:00Z' },
      { sequenceNumber: 3, rung: 'STUDIO_MGR', action: 'ADVANCE', actorUserId: 'u3', occurredAt: '2026-05-03T00:00:00Z' },
      { sequenceNumber: 4, rung: 'ACD',        action: 'ADVANCE', actorUserId: 'u4', occurredAt: '2026-05-04T00:00:00Z' },
    ],
    tierAtOpen: 'TIER_1',
    initializedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('ApprovalChainTimeline', () => {
  it('renders one item per ladder rung', () => {
    render(<ApprovalChainTimeline chain={chain()} />);
    for (const rung of ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD']) {
      expect(screen.getByTestId(`ladder-rung-${rung}`)).toBeDefined();
    }
  });

  it('marks rungs before currentRung as granted', () => {
    render(<ApprovalChainTimeline chain={chain()} />);
    expect(screen.getByTestId('ladder-rung-DESIGNER').getAttribute('data-status')).toBe('granted');
    expect(screen.getByTestId('ladder-rung-AD').getAttribute('data-status')).toBe('granted');
    expect(screen.getByTestId('ladder-rung-STUDIO_MGR').getAttribute('data-status')).toBe('granted');
  });

  it('marks currentRung as current and later rungs as pending', () => {
    render(<ApprovalChainTimeline chain={chain()} />);
    expect(screen.getByTestId('ladder-rung-ACD').getAttribute('data-status')).toBe('current');
    expect(screen.getByTestId('ladder-rung-CD').getAttribute('data-status')).toBe('pending');
    expect(screen.getByTestId('ladder-rung-ECD').getAttribute('data-status')).toBe('pending');
  });

  it('marks every rung as granted when chain is complete', () => {
    render(<ApprovalChainTimeline chain={chain({ currentRung: 'ECD', complete: true })} />);
    for (const rung of ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD']) {
      expect(screen.getByTestId(`ladder-rung-${rung}`).getAttribute('data-status')).toBe('granted');
    }
  });

  it('shows reject-loop count when history has REJECT entries', () => {
    const c = chain({
      currentRung: 'DESIGNER',
      history: [
        { sequenceNumber: 1, rung: 'DESIGNER', action: 'INIT',    actorUserId: 'u1', occurredAt: '2026-05-01T00:00:00Z' },
        { sequenceNumber: 2, rung: 'AD',       action: 'ADVANCE', actorUserId: 'u2', occurredAt: '2026-05-02T00:00:00Z' },
        { sequenceNumber: 3, rung: 'AD',       action: 'REJECT',  actorUserId: 'u2', notes: 'tighten copy', occurredAt: '2026-05-03T00:00:00Z' },
        { sequenceNumber: 4, rung: 'DESIGNER', action: 'INIT',    actorUserId: 'u1', occurredAt: '2026-05-04T00:00:00Z' },
      ],
    });
    render(<ApprovalChainTimeline chain={c} />);
    expect(screen.getByTestId('reject-loop-count').textContent).toContain('1 reject');
  });

  it('renders correctly for a collapsed TIER_3 ladder', () => {
    const c = chain({
      ladder: ['STUDIO_MGR', 'CD'],
      currentRung: 'STUDIO_MGR',
      tierAtOpen: 'TIER_3',
      history: [
        { sequenceNumber: 1, rung: 'STUDIO_MGR', action: 'INIT', actorUserId: 'u1', occurredAt: '2026-05-01T00:00:00Z' },
      ],
    });
    render(<ApprovalChainTimeline chain={c} />);
    expect(screen.getByTestId('ladder-rung-STUDIO_MGR')).toBeDefined();
    expect(screen.getByTestId('ladder-rung-CD')).toBeDefined();
    expect(screen.queryByTestId('ladder-rung-DESIGNER')).toBeNull();
  });
});
