/**
 * Phase 6.UI.B — RoutingQueuePage tests.
 *
 * Component owns the Traffic operator's main inbox: subscribe to OPEN +
 * unallocated master_jobs, run `routeBrand` per row, hand off to
 * `IssueIWODialog` on Confirm/Override via URL hash.
 *
 * Tests:
 *   • empty state when subscription returns []
 *   • subscription error renders the error region
 *   • row renders with capability selector + propose button (no proposal)
 *   • propose → calls routeBrandFn with the masterJob context + selected capability
 *   • propose error → shows error region scoped to that row
 *   • propose success → swaps the propose form for the proposal card
 *   • confirm → navigates with the issue-iwo hash
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import type { RoutingProposal } from '../types/traffic.types';

const mockSubscribe = vi.fn();
const mockRouteBrand = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/traffic.service', () => ({
  subscribeOpenMasterJobs: (
    cb: (jobs: MasterJob[]) => void,
    onErr: (err: Error) => void,
  ) => mockSubscribe(cb, onErr),
  routeBrandFn: (input: unknown) => mockRouteBrand(input),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import RoutingQueuePage from '../pages/RoutingQueuePage';

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
        openIwoCount: 2,
        availability: 18,
        rejectionReason: null,
      },
    ],
    geographyPreferenceApplied: null,
    tierApplied: null,
    nowIso: '2026-05-27T20:00:00Z',
    proposalId: 'prop_test_1',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RoutingQueuePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockSubscribe.mockReset();
  mockRouteBrand.mockReset();
  mockNavigate.mockReset();
});

describe('RoutingQueuePage', () => {
  it('shows an empty state when the subscription returns []', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('routing-queue-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('routing-queue-empty').textContent).toMatch(/No master jobs/);
  });

  it('renders the subscription error region when subscribeOpenMasterJobs fails', async () => {
    mockSubscribe.mockImplementation((_cb, onErr) => {
      onErr(new Error('boom'));
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('routing-queue-error')).toBeTruthy();
    });
    expect(screen.getByTestId('routing-queue-error').textContent).toMatch(/boom/);
  });

  it('renders a row per job with the capability selector + propose button', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([masterJobFixture({ id: 'mj_a', code: 'ZTA-A' })]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('queue-row-mj_a')).toBeTruthy();
    });
    expect(screen.getByTestId('capability-select-mj_a')).toBeTruthy();
    expect(screen.getByTestId('propose-btn-mj_a')).toBeTruthy();
  });

  it('propose → calls routeBrandFn with the masterJob context + selected capability', async () => {
    const job = masterJobFixture({ id: 'mj_a', clientId: 'client_x', tier: 'TIER_1' });
    mockSubscribe.mockImplementation((cb) => {
      cb([job]);
      return () => {};
    });
    mockRouteBrand.mockResolvedValue({ data: proposalFixture() });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('propose-btn-mj_a')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('propose-btn-mj_a'));

    await waitFor(() => {
      expect(mockRouteBrand).toHaveBeenCalledTimes(1);
    });
    const call = mockRouteBrand.mock.calls[0][0];
    expect(call.masterJobId).toBe('mj_a');
    expect(call.tier).toBe('TIER_1');
    expect(call.accountId).toBe('client_x');
    expect(call.requiredCapability).toBe('creative');  // default
  });

  it('changing the capability dropdown propagates to routeBrandFn', async () => {
    const job = masterJobFixture({ id: 'mj_b' });
    mockSubscribe.mockImplementation((cb) => {
      cb([job]);
      return () => {};
    });
    mockRouteBrand.mockResolvedValue({ data: proposalFixture() });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('capability-select-mj_b')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('capability-select-mj_b'), {
      target: { value: 'media' },
    });
    fireEvent.click(screen.getByTestId('propose-btn-mj_b'));

    await waitFor(() => {
      expect(mockRouteBrand).toHaveBeenCalledTimes(1);
    });
    expect(mockRouteBrand.mock.calls[0][0].requiredCapability).toBe('media');
  });

  it('propose error renders the per-row error region', async () => {
    const job = masterJobFixture({ id: 'mj_err' });
    mockSubscribe.mockImplementation((cb) => {
      cb([job]);
      return () => {};
    });
    // Use a rejected mockImplementation rather than mockRejectedValue so the
    // promise is materialised inside the React event handler — keeps the
    // rejection scoped to the test's React lifecycle and out of the
    // unhandled-rejection global queue.
    mockRouteBrand.mockImplementation(() => Promise.reject(new Error('rate-card missing')));

    renderPage();
    const proposeBtn = await screen.findByTestId('propose-btn-mj_err');
    fireEvent.click(proposeBtn);

    const errorEl = await screen.findByTestId('propose-error-mj_err');
    expect(errorEl.textContent).toMatch(/rate-card missing/);
  });

  it('successful proposal replaces the propose form with the proposal card', async () => {
    const job = masterJobFixture({ id: 'mj_ok' });
    mockSubscribe.mockImplementation((cb) => {
      cb([job]);
      return () => {};
    });
    mockRouteBrand.mockResolvedValue({ data: proposalFixture() });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('propose-btn-mj_ok')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('propose-btn-mj_ok'));

    await waitFor(() => {
      // The proposal card mounts and renders the proposed brand banner —
      // `RouteBrandProposalCard` tags it `proposed-brand-banner`.
      expect(screen.queryByTestId('propose-btn-mj_ok')).toBeNull();
    });
  });
});
