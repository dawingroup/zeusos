/**
 * Phase 6.UI.B — RouteBrandProposalCard tests.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBrandProposalCard } from '../components/RouteBrandProposalCard';
import type { RoutingProposal } from '../types/traffic.types';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';

function masterJobFixture(overrides: Partial<MasterJob> = {}): MasterJob {
  return {
    id: 'mj_1',
    sowId: 'sow_1',
    quoteId: 'q_1',
    clientId: 'client_1',
    code: 'ZTA-DIAGEO-2026-014',
    status: 'OPEN',
    allocatedMinor: 0,
    ceilingMinor: 1_000_000,
    clientTotalMinor: 1_200_000,
    currency: 'UGX',
    tier: 'TIER_2',
    campaign: {
      clientName: 'Diageo',
      name: 'Smirnoff EOY',
    } as MasterJob['campaign'],
    createdBy: 'u_1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function proposalFixture(overrides: Partial<RoutingProposal> = {}): RoutingProposal {
  return {
    proposedBrandId: 'zeus-the-agency',
    reasonNoCandidate: null,
    candidates: [
      {
        brandId: 'zeus-the-agency',
        hasCapability: true,
        conflicted: false,
        openIwoCount: 3,
        availability: 17,
        rejectionReason: null,
      },
      {
        brandId: 'labyrinth',
        hasCapability: false,
        conflicted: false,
        openIwoCount: 0,
        availability: 20,
        rejectionReason: 'NO_CAPABILITY',
      },
    ],
    geographyPreferenceApplied: null,
    tierApplied: 'TIER_2',
    nowIso: new Date().toISOString(),
    proposalId: 'routing_001',
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof RouteBrandProposalCard>[0]> = {}) {
  const defaults = {
    masterJob: masterJobFixture(),
    proposal: proposalFixture(),
    onConfirm: vi.fn(),
    onOverride: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <RouteBrandProposalCard {...defaults} {...props} />
    </MemoryRouter>,
  );
}

describe('RouteBrandProposalCard', () => {
  it('shows the proposed brand banner with the engine recommendation', () => {
    renderCard();
    expect(screen.getByTestId('proposed-brand-id').textContent).toBe('zeus-the-agency');
    expect(screen.getByTestId('tier-badge').textContent).toBe('Tier 2');
  });

  it('Confirm-and-issue fires onConfirm with the proposed brand', () => {
    const onConfirm = vi.fn();
    renderCard({ onConfirm });
    fireEvent.click(screen.getByTestId('confirm-and-issue-btn'));
    expect(onConfirm).toHaveBeenCalledWith('zeus-the-agency');
  });

  it('Override flow opens the editor and fires onOverride with the picked brand + reason', () => {
    const onOverride = vi.fn();
    renderCard({ onOverride });
    fireEvent.click(screen.getByTestId('open-override-btn'));
    fireEvent.change(screen.getByTestId('override-brand-select'), { target: { value: 'labyrinth' } });
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: 'AM has prior relationship' },
    });
    fireEvent.click(screen.getByTestId('confirm-override-btn'));
    expect(onOverride).toHaveBeenCalledWith('labyrinth', 'AM has prior relationship');
  });

  it('renders the NO_ELIGIBLE_BRAND banner and disables Confirm', () => {
    renderCard({
      proposal: proposalFixture({
        proposedBrandId: null,
        reasonNoCandidate: 'NO_ELIGIBLE_BRAND',
        candidates: [
          {
            brandId: 'zeus-the-agency',
            hasCapability: false,
            conflicted: false,
            openIwoCount: 0,
            availability: 20,
            rejectionReason: 'NO_CAPABILITY',
          },
        ],
      }),
    });
    expect(screen.queryByTestId('proposal-no-eligible')).not.toBeNull();
    const confirmBtn = screen.getByTestId('confirm-and-issue-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('shows the KE-geography badge when the engine applied it', () => {
    renderCard({
      proposal: proposalFixture({
        proposedBrandId: 'house-of-zeus',
        geographyPreferenceApplied: 'house-of-zeus',
      }),
    });
    expect(screen.getByTestId('geography-preference-badge').textContent).toContain('KE preference');
  });
});
