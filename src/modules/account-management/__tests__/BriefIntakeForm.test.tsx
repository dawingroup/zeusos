/**
 * BriefIntakeForm tests — Phase 6.UI.D.1 (PR 5).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();

vi.mock('../services/brief-ces.service', () => ({
  updateMasterJobBriefFn: (input: unknown) => mockUpdate(input),
}));

import { BriefIntakeForm } from '../components/BriefIntakeForm';
import type { Brief } from '@/modules/campaigns/types/campaign.types';

beforeEach(() => {
  mockUpdate.mockReset();
  mockUpdate.mockResolvedValue({ data: { masterJobId: 'mj_1', updated: true } });
});

function renderForm(brief?: Brief) {
  return render(<BriefIntakeForm masterJobId="mj_1" brief={brief} />);
}

describe('BriefIntakeForm', () => {
  it('renders tier + objectives + target audience inputs', () => {
    renderForm();
    expect(screen.getByTestId('brief-tier-input')).toBeDefined();
    expect(screen.getByTestId('brief-objectives-input')).toBeDefined();
    expect(screen.getByTestId('brief-target-audience-input')).toBeDefined();
  });

  it('seeds inputs from an existing brief', () => {
    renderForm({
      tier: 1,
      objectives: 'Drive Tier 1 launch',
      targetAudience: '18-34 urban',
      kpis: [],
    });
    expect((screen.getByTestId('brief-tier-input') as HTMLSelectElement).value).toBe('1');
    expect((screen.getByTestId('brief-objectives-input') as HTMLTextAreaElement).value).toBe('Drive Tier 1 launch');
    expect((screen.getByTestId('brief-target-audience-input') as HTMLInputElement).value).toBe('18-34 urban');
  });

  it('adds an agency contributor and surfaces a client-side warning when only one side is recorded', () => {
    renderForm();
    fireEvent.click(screen.getByTestId('add-contribution-agency'));
    // Validation should warn that no client contribution exists.
    expect(screen.queryByTestId('brief-warning-NO_CLIENT_CONTRIBUTION')).not.toBeNull();
  });

  it('clears co-author warnings when both sides are recorded', () => {
    renderForm();
    fireEvent.click(screen.getByTestId('add-contribution-agency'));
    fireEvent.click(screen.getByTestId('add-contribution-client'));
    expect(screen.queryByTestId('brief-warning-NO_AGENCY_CONTRIBUTION')).toBeNull();
    expect(screen.queryByTestId('brief-warning-NO_CLIENT_CONTRIBUTION')).toBeNull();
  });

  it('saves and calls updateMasterJobBriefFn with the entered fields', async () => {
    renderForm();
    fireEvent.change(screen.getByTestId('brief-objectives-input'), { target: { value: 'Big idea' } });
    fireEvent.change(screen.getByTestId('brief-target-audience-input'), { target: { value: 'Adults 25+' } });
    fireEvent.click(screen.getByTestId('brief-save-btn'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const call = mockUpdate.mock.calls[0][0] as { masterJobId: string; brief: Record<string, unknown> };
    expect(call.masterJobId).toBe('mj_1');
    expect(call.brief.objectives).toBe('Big idea');
    expect(call.brief.targetAudience).toBe('Adults 25+');
  });

  it('shows the saved banner after a successful save', async () => {
    renderForm();
    fireEvent.change(screen.getByTestId('brief-objectives-input'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('brief-save-btn'));
    await waitFor(() => expect(screen.queryByTestId('brief-saved-banner')).not.toBeNull());
  });
});
