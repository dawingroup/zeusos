/**
 * Unit tests — Production module (Phase 4).
 *
 * Covers:
 *   - Stage-advance guard: cannot skip stages
 *   - Stage-advance guard: cannot advance past COMPLETE
 *   - advanceProductionStage happy path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProductionJob } from '../types/production-job.types';
import { PRODUCTION_STAGES } from '../types/production-job.types';

// ─────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

// We'll track updateDoc calls.
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection:      vi.fn(),
  doc:             vi.fn((_, __, id) => ({ __id: id, __path: `production_jobs/${id}` })),
  addDoc:          vi.fn(),
  getDoc:          mockGetDoc,
  getDocs:         vi.fn(),
  updateDoc:       mockUpdateDoc,
  query:           vi.fn(),
  where:           vi.fn(),
  orderBy:         vi.fn(),
  serverTimestamp: vi.fn(() => '__SERVER_TS__'),
}));

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function makeJob(stage: ProductionJob['stage']): ProductionJob {
  return {
    id: 'job-001',
    title: 'Test TVC',
    type: 'TVC',
    masterJobId: 'mj-001',
    stage,
    subsidiaryOrgId: 'zeus-the-agency',
    producerId: 'user-001',
    stageHistory: [],
    createdBy: 'user-001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe('PRODUCTION_STAGES ordering', () => {
  it('starts with BRIEF', () => {
    expect(PRODUCTION_STAGES[0]).toBe('BRIEF');
  });

  it('ends with COMPLETE', () => {
    expect(PRODUCTION_STAGES[PRODUCTION_STAGES.length - 1]).toBe('COMPLETE');
  });

  it('has exactly 10 stages', () => {
    expect(PRODUCTION_STAGES.length).toBe(10);
  });

  it('SHOOT comes immediately after EQUIPMENT', () => {
    const equipmentIdx = PRODUCTION_STAGES.indexOf('EQUIPMENT');
    expect(PRODUCTION_STAGES[equipmentIdx + 1]).toBe('SHOOT');
  });
});

describe('advanceProductionStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advances BRIEF → PRE_PRODUCTION', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'job-001',
      data: () => makeJob('BRIEF'),
    });

    const { advanceProductionStage } = await import('../services/production-job.service');
    const nextStage = await advanceProductionStage('job-001', 'user-abc');

    expect(nextStage).toBe('PRE_PRODUCTION');
    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.stage).toBe('PRE_PRODUCTION');
    expect(payload.stageHistory).toHaveLength(1);
    expect(payload.stageHistory[0].fromStage).toBe('BRIEF');
    expect(payload.stageHistory[0].toStage).toBe('PRE_PRODUCTION');
  });

  it('throws when job is already at COMPLETE', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'job-001',
      data: () => makeJob('COMPLETE'),
    });

    const { advanceProductionStage } = await import('../services/production-job.service');
    await expect(advanceProductionStage('job-001', 'user-abc')).rejects.toThrow(
      /already at COMPLETE/,
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when job is not found', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { advanceProductionStage } = await import('../services/production-job.service');
    await expect(advanceProductionStage('missing-id', 'user-abc')).rejects.toThrow(
      /not found/,
    );
  });

  it('cannot skip stages — advancing POST_PRODUCTION goes to CLIENT_REVIEW not MASTER_DELIVERY', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'job-001',
      data: () => makeJob('POST_PRODUCTION'),
    });

    const { advanceProductionStage } = await import('../services/production-job.service');
    const next = await advanceProductionStage('job-001', 'user-abc');
    // Can only go to the immediate next stage
    expect(next).toBe('CLIENT_REVIEW');
    expect(next).not.toBe('MASTER_DELIVERY');
  });
});
