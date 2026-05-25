/**
 * Phase 6.UI.B — CandidateRejectionList tests.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CandidateRejectionList } from '../components/CandidateRejectionList';
import type { BrandCandidate } from '../types/traffic.types';

function fixture(overrides: Partial<BrandCandidate> = {}): BrandCandidate {
  return {
    brandId: 'zeus-the-agency',
    hasCapability: true,
    conflicted: false,
    openIwoCount: 3,
    availability: 17,
    rejectionReason: null,
    ...overrides,
  };
}

describe('CandidateRejectionList', () => {
  it('highlights the proposed brand and labels eligible candidates "Eligible"', () => {
    render(
      <CandidateRejectionList
        candidates={[
          fixture({ brandId: 'zeus-the-agency' }),
          fixture({ brandId: 'labyrinth', rejectionReason: 'NO_CAPABILITY' }),
        ]}
        proposedBrandId="zeus-the-agency"
      />,
    );
    expect(screen.getByTestId('candidate-zeus-the-agency-reason').textContent).toBe('Eligible');
    expect(screen.getByTestId('candidate-labyrinth-reason').textContent).toBe('Capability not declared');
  });

  it('humanises every rejection reason variant', () => {
    render(
      <CandidateRejectionList
        candidates={[
          fixture({ brandId: 'zeus-the-agency', rejectionReason: 'NO_CAPABILITY' }),
          fixture({ brandId: 'zeus-digital',    rejectionReason: 'CONFLICTED' }),
          fixture({ brandId: 'labyrinth',       rejectionReason: 'AT_CAPACITY' }),
        ]}
        proposedBrandId={null}
      />,
    );
    expect(screen.getByTestId('candidate-zeus-the-agency-reason').textContent).toBe('Capability not declared');
    expect(screen.getByTestId('candidate-zeus-digital-reason').textContent).toBe('Conflict-firewall block');
    expect(screen.getByTestId('candidate-labyrinth-reason').textContent).toBe('At capacity');
  });

  it('shows the openIwoCount inline for each candidate', () => {
    render(
      <CandidateRejectionList
        candidates={[fixture({ brandId: 'zeus-the-agency', openIwoCount: 12 })]}
        proposedBrandId="zeus-the-agency"
      />,
    );
    expect(screen.getByTestId('candidate-zeus-the-agency').textContent).toContain('12 open');
  });
});
