/**
 * CesTable tests — Phase 6.UI.D.3 (PR 5).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/brief-ces.service', () => ({
  signOffCesFn: vi.fn().mockResolvedValue({ data: { masterJobId: 'mj_1', signedOff: true } }),
  postCesLineItemFn: vi.fn(),
}));

import { CesTable } from '../components/CesTable';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import type { CES, CESLineItem } from '@/modules/contracts/types/ces.types';

function lineItem(overrides: Partial<CESLineItem> = {}): CESLineItem {
  return {
    id: 'li_1',
    category: 'LABOR_INTERNAL',
    description: 'Senior designer × 8h',
    amountMinor: 80_000_00,
    currency: 'UGX',
    addedBy: 'user-1',
    addedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function masterJob(ces?: Partial<CES>): MasterJob {
  const base: MasterJob = {
    id: 'mj_1',
    sowId: 'sow_1',
    quoteId: 'q_1',
    clientId: 'client_1',
    code: 'ZTA-DIAGEO-2026-014',
    status: 'OPEN',
    allocatedMinor: 0,
    ceilingMinor: 200_000_00,
    clientTotalMinor: 200_000_00,
    currency: 'UGX',
    createdBy: 'u_1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  };
  if (ces !== undefined) {
    return {
      ...base,
      ces: {
        lineItems: [],
        totalMinor: 0,
        currency: 'UGX',
        signedOff: false,
        updatedAt: '2026-05-01T00:00:00Z',
        ...ces,
      } as CES,
    };
  }
  return base;
}

describe('CesTable', () => {
  it('renders the empty state when no CES exists yet', () => {
    render(<CesTable masterJob={masterJob()} />);
    expect(screen.queryByTestId('ces-empty')).not.toBeNull();
    const signOff = screen.getByTestId('ces-sign-off-btn') as HTMLButtonElement;
    expect(signOff.disabled).toBe(true);
  });

  it('renders line items with category badges and a total', () => {
    const mj = masterJob({
      lineItems: [
        lineItem({ id: 'li_1', description: 'Designer × 8h', amountMinor: 80_000_00 }),
        lineItem({ id: 'li_2', category: 'PRODUCTION', description: 'Print run', amountMinor: 40_000_00 }),
      ],
      totalMinor: 120_000_00,
    });
    render(<CesTable masterJob={mj} />);
    expect(screen.queryByTestId('ces-line-li_1')).not.toBeNull();
    expect(screen.queryByTestId('ces-line-li_2')).not.toBeNull();
    expect(screen.getByTestId('ces-line-li_1-category').textContent).toBe('Internal');
    expect(screen.getByTestId('ces-line-li_2-category').textContent).toBe('Production');
    // 80,000_00 + 40,000_00 = 120,000.00 in major units.
    expect(screen.getByTestId('ces-total').textContent).toContain('120,000');
  });

  it('enables the sign-off button once line items exist', () => {
    const mj = masterJob({
      lineItems: [lineItem({ id: 'li_1', amountMinor: 80_000_00 })],
      totalMinor: 80_000_00,
    });
    render(<CesTable masterJob={mj} />);
    const signOff = screen.getByTestId('ces-sign-off-btn') as HTMLButtonElement;
    expect(signOff.disabled).toBe(false);
  });

  it('renders the signed-off banner and floor when CES is signed', () => {
    const mj = masterJob({
      lineItems: [lineItem({ id: 'li_1', amountMinor: 100_000_00 })],
      totalMinor: 100_000_00,
      signedOff: true,
      signedOffByUserId: 'u_1',
      signedOffAt: '2026-05-02T00:00:00Z',
      marginFloorPct: 25,
    });
    render(<CesTable masterJob={mj} />);
    expect(screen.queryByTestId('ces-signed-off-banner')).not.toBeNull();
    // 100,000.00 × 1.25 = 125,000.00 in major units.
    expect(screen.getByTestId('ces-floor').textContent).toContain('125,000');
    // Sign-off button is disabled post-sign-off
    expect((screen.getByTestId('ces-sign-off-btn') as HTMLButtonElement).disabled).toBe(true);
    // Add line item button is hidden post-sign-off
    expect(screen.queryByTestId('add-ces-line-item-btn')).toBeNull();
  });

  it('shows below-floor warning when linked quote total < floor', () => {
    const mj = masterJob({
      lineItems: [lineItem({ id: 'li_1', amountMinor: 100_000_00 })],
      totalMinor: 100_000_00,
      signedOff: true,
      marginFloorPct: 25,
    });
    // Quote = 110,000.00; floor = 125,000.00 → below
    render(<CesTable masterJob={mj} linkedQuoteTotalMinor={110_000_00} />);
    expect(screen.queryByTestId('ces-below-floor')).not.toBeNull();
    expect(screen.queryByTestId('ces-above-floor')).toBeNull();
  });

  it('shows above-floor confirmation when linked quote total ≥ floor', () => {
    const mj = masterJob({
      lineItems: [lineItem({ id: 'li_1', amountMinor: 100_000_00 })],
      totalMinor: 100_000_00,
      signedOff: true,
      marginFloorPct: 25,
    });
    // Quote = 140,000.00; floor = 125,000.00 → above
    render(<CesTable masterJob={mj} linkedQuoteTotalMinor={140_000_00} />);
    expect(screen.queryByTestId('ces-above-floor')).not.toBeNull();
    expect(screen.queryByTestId('ces-below-floor')).toBeNull();
  });

  it('skips the quote-vs-floor comparison when CES is not signed off', () => {
    const mj = masterJob({
      lineItems: [lineItem({ id: 'li_1', amountMinor: 100_000_00 })],
      totalMinor: 100_000_00,
      signedOff: false,
    });
    render(<CesTable masterJob={mj} linkedQuoteTotalMinor={110_000_00} />);
    expect(screen.queryByTestId('ces-quote-comparison')).toBeNull();
  });
});
