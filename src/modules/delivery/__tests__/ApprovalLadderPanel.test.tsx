/**
 * ApprovalLadderPanel tests — Phase 6.UI.D.2.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAdvance = vi.fn();
const mockReject = vi.fn();

vi.mock('../services/approval-ladder.service', () => ({
  advanceApprovalRungFn: (input: unknown) => mockAdvance(input),
  rejectApprovalRungFn: (input: unknown) => mockReject(input),
}));

import { ApprovalLadderPanel } from '../components/ApprovalLadderPanel';
import type { ApprovalChain } from '@/modules/assignment/types/approval-chain.types';

function chain(overrides: Partial<ApprovalChain> = {}): ApprovalChain {
  return {
    ladder: ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD'],
    currentRung: 'ACD',
    complete: false,
    history: [
      { sequenceNumber: 1, rung: 'DESIGNER', action: 'INIT',    actorUserId: 'u1', occurredAt: '2026-05-01T00:00:00Z' },
      { sequenceNumber: 2, rung: 'AD',       action: 'ADVANCE', actorUserId: 'u2', occurredAt: '2026-05-02T00:00:00Z' },
    ],
    tierAtOpen: 'TIER_1',
    initializedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockAdvance.mockReset();
  mockReject.mockReset();
  mockAdvance.mockResolvedValue({ data: { id: 'iwo_1', rung: 'CD', terminal: false } });
  mockReject.mockResolvedValue({ data: { id: 'iwo_1', rung: 'DESIGNER', reset: true } });
});

describe('ApprovalLadderPanel', () => {
  it('shows Advance + Reject CTAs when chain is open', () => {
    render(<ApprovalLadderPanel iwoId="iwo_1" chain={chain()} />);
    expect(screen.getByTestId('advance-rung-btn')).toBeDefined();
    expect(screen.getByTestId('open-reject-btn')).toBeDefined();
    expect(screen.queryByTestId('approval-complete-banner')).toBeNull();
  });

  it('Advance fires advanceApprovalRungFn with iwoId', async () => {
    render(<ApprovalLadderPanel iwoId="iwo_1" chain={chain()} />);
    fireEvent.click(screen.getByTestId('advance-rung-btn'));
    await waitFor(() => expect(mockAdvance).toHaveBeenCalledTimes(1));
    expect(mockAdvance).toHaveBeenCalledWith({ iwoId: 'iwo_1' });
  });

  it('Reject flow requires notes and fires rejectApprovalRungFn with them', async () => {
    render(<ApprovalLadderPanel iwoId="iwo_1" chain={chain()} />);
    fireEvent.click(screen.getByTestId('open-reject-btn'));
    const confirm = screen.getByTestId('confirm-reject-btn') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('reject-notes-input'), {
      target: { value: 'Headline reads as passive — make it active.' },
    });
    expect((screen.getByTestId('confirm-reject-btn') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));
    await waitFor(() => expect(mockReject).toHaveBeenCalledTimes(1));
    expect(mockReject).toHaveBeenCalledWith({
      iwoId: 'iwo_1',
      notes: 'Headline reads as passive — make it active.',
    });
  });

  it('renders the granted banner when chain.complete is true', () => {
    render(<ApprovalLadderPanel iwoId="iwo_1" chain={chain({ currentRung: 'ECD', complete: true })} />);
    expect(screen.queryByTestId('approval-complete-banner')).not.toBeNull();
    expect(screen.queryByTestId('advance-rung-btn')).toBeNull();
  });

  it('Cancel returns to the action buttons without firing the reject callable', () => {
    render(<ApprovalLadderPanel iwoId="iwo_1" chain={chain()} />);
    fireEvent.click(screen.getByTestId('open-reject-btn'));
    expect(screen.getByTestId('reject-editor')).toBeDefined();
    fireEvent.click(screen.getByTestId('cancel-reject-btn'));
    expect(screen.queryByTestId('reject-editor')).toBeNull();
    expect(mockReject).not.toHaveBeenCalled();
  });
});
