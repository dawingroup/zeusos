/**
 * P5 — `dealSyncService` must SKIP design projects that lack a
 * `customerId`, not mint a synthetic `proj_${id}` stand-in.
 *
 * This test pins the fix for audit finding F4: the old fallback was
 * creating CRM deals pointed at customer IDs that never existed, which
 * both violated P5 and polluted the CRM pipeline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The service under test pulls projects + deals via `fetchCollection`
// and writes deals via `createDeal`. Mock both so the test drives
// behaviour without touching Firestore.
const fetchCollection = vi.fn();
vi.mock('@/shared/services/firebase/firestore', () => ({
  fetchCollection: (...args: unknown[]) => fetchCollection(...args),
}));

const createDeal = vi.fn();
vi.mock('../crmDealService', () => ({
  createDeal: (...args: unknown[]) => createDeal(...args),
}));

import { syncDealsForProjects } from '../dealSyncService';
import type { DesignProject } from '@/modules/design-manager/types';

function makeProject(over: Partial<DesignProject>): DesignProject {
  return {
    id: 'proj-1',
    code: 'P-001',
    name: 'Test Project',
    customerId: 'cust-1',
    customerName: 'Acme Ltd',
    status: 'active',
    createdAt: undefined as unknown as DesignProject['createdAt'],
    updatedAt: undefined as unknown as DesignProject['updatedAt'],
    createdBy: 'u1',
    updatedBy: 'u1',
    ...over,
  };
}

describe('P5 — syncDealsForProjects orphan handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips a project with no customerId instead of minting a synthetic one', async () => {
    fetchCollection
      // First call: projects
      .mockResolvedValueOnce([
        makeProject({ id: 'orphan-1', customerId: undefined as unknown as string }),
      ])
      // Second call: existing deals
      .mockResolvedValueOnce([]);

    const result = await syncDealsForProjects('u1', 'User One');

    expect(createDeal).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    // Debug entry must explicitly call out the skip reason so the sync
    // operator knows to run the backfill.
    expect(result.debug.some(d => d.includes('no customerId'))).toBe(true);
  });

  it('skips a project with an empty-string customerId', async () => {
    fetchCollection
      .mockResolvedValueOnce([makeProject({ id: 'orphan-2', customerId: '' })])
      .mockResolvedValueOnce([]);

    const result = await syncDealsForProjects('u1', 'User One');

    expect(createDeal).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('still creates a deal for a project that has a valid customerId', async () => {
    fetchCollection
      .mockResolvedValueOnce([makeProject({ id: 'good-1', customerId: 'cust-ok' })])
      .mockResolvedValueOnce([]);
    createDeal.mockResolvedValueOnce({ id: 'deal-1' });

    const result = await syncDealsForProjects('u1', 'User One');

    expect(createDeal).toHaveBeenCalledTimes(1);
    const dealData = createDeal.mock.calls[0]?.[0] as { customerId: string };
    expect(dealData.customerId).toBe('cust-ok');
    // Explicitly assert no synthetic `proj_` prefix leaked through.
    expect(dealData.customerId.startsWith('proj_')).toBe(false);
    expect(result.created).toBe(1);
  });

  it('processes a mixed batch without aborting the whole run', async () => {
    fetchCollection
      .mockResolvedValueOnce([
        makeProject({ id: 'orphan-3', customerId: undefined as unknown as string }),
        makeProject({ id: 'good-2', customerId: 'cust-ok' }),
      ])
      .mockResolvedValueOnce([]);
    createDeal.mockResolvedValueOnce({ id: 'deal-2' });

    const result = await syncDealsForProjects('u1', 'User One');

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});
