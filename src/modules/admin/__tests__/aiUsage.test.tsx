/**
 * The AI usage page: derivations are pure and honest (cost per successful
 * call, the waste finder), and the page reads the rollups, shows the month and
 * the breakdown, and pauses a feature through the policy.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { AiUsageDaily, AiUsageMonthly } from '../types/aiUsage';
import { EMPTY_BUCKET, findWaste, mergeBreakdown, projectMonth, sumDays, toRows } from '../services/aiUsageService';

const mockSetFeature = vi.fn();
const mockSave = vi.fn();
let days: AiUsageDaily[] = [];

vi.mock('@/core/settings', () => ({ useCurrentDawinUser: () => ({ dawinUser: { globalRole: 'admin' } }) }));
vi.mock('../services/aiUsageService', async () => {
  const actual = await vi.importActual<typeof import('../services/aiUsageService')>('../services/aiUsageService');
  return {
    ...actual,
    getRecentDays: async () => days,
    getMonth: async () => ({ ...actual.EMPTY_BUCKET, month: '2026-10', days: 10, costUsd: 25, costUgx: 92500, cacheHitRate: 0, successRate: 1, byFeature: {}, byModel: {}, byProvider: {}, byAgent: {}, bySubsidiary: {} }),
    getPolicy: async () => ({ monthlyBudgetUsd: 100, dailyBudgetUsd: null, alertThresholds: [0.5, 0.8, 1], ugxPerUsd: null, features: { 'market.scan': { enabled: false } }, agents: {} }),
    setFeatureEnabled: (...a: unknown[]) => mockSetFeature(...a),
    savePolicy: (...a: unknown[]) => mockSave(...a),
  };
});

import AiUsagePage from '../pages/AiUsagePage';

const bucket = (over: Partial<typeof EMPTY_BUCKET>) => ({ ...EMPTY_BUCKET, ...over });
const day = (date: string, over: Partial<AiUsageDaily>): AiUsageDaily => ({
  ...EMPTY_BUCKET, date, unpricedCalls: 0, fallbackCalls: 0, retryCalls: 0, cacheHitRate: 0, successRate: 1, latencyMsP50: 0, latencyMsP95: 0,
  byFeature: {}, byModel: {}, byProvider: {}, byTrigger: {}, bySubsidiary: {}, byAgent: {}, byUser: {}, ...over,
});

describe('derivations', () => {
  it('rows rank by cost, cost per successful call is honest, the waste finder names what cost money', () => {
    const d1 = day('2026-10-28', { calls: 10, okCalls: 8, wasteCalls: 2, costUsd: 5, wasteCostUsd: 1, inputTokens: 1000, cacheReadTokens: 100, byFeature: { 'memos.draft': bucket({ calls: 10, okCalls: 8, costUsd: 5 }) } });
    const d2 = day('2026-10-29', { calls: 4, okCalls: 0, wasteCalls: 4, costUsd: 2, wasteCostUsd: 2, unpricedCalls: 1, retryCalls: 2, byFeature: { 'market.scan': bucket({ calls: 4, okCalls: 0, costUsd: 2 }), 'memos.draft': bucket({ calls: 0, costUsd: 0.5 }) } });
    const totals = sumDays([d1, d2]);
    expect(totals.calls).toBe(14);
    expect(totals.wasteCostUsd).toBe(3);
    const rows = toRows(mergeBreakdown([d1, d2], 'byFeature'));
    expect(rows.map((r) => r.key)).toEqual(['memos.draft', 'market.scan']);
    expect(rows[0].costUsd).toBe(5.5);
    expect(rows[0].costPerOkCallUsd).toBeCloseTo(5.5 / 8);
    expect(rows[1].costPerOkCallUsd).toBe(2);
    expect(rows[0].shareOfCost).toBeCloseTo(5.5 / 7.5);
    const waste = findWaste([d1, d2]);
    expect(waste.map((w) => w.id)).toEqual(['failed-calls', 'retries', 'unpriced', 'cold-cache']);
    expect(waste[0].severity).toBe('critical');
    expect(findWaste([])).toEqual([]);
    const month: AiUsageMonthly = { ...EMPTY_BUCKET, month: '2026-10', days: 10, costUsd: 25, cacheHitRate: 0, successRate: 1, byFeature: {}, byModel: {}, byProvider: {}, byAgent: {}, bySubsidiary: {} };
    expect(projectMonth(month, new Date('2026-10-29T00:00:00Z'))).toBe(77.5);
    expect(projectMonth(null)).toBeNull();
  });
});

describe('AiUsagePage', () => {
  it('shows the month, the budget, the breakdown and pauses a feature through the policy', async () => {
    days = [day('2026-10-29', { calls: 3, okCalls: 3, costUsd: 1.5, byFeature: { 'memos.draft': bucket({ calls: 2, okCalls: 2, costUsd: 1 }), 'market.scan': bucket({ calls: 1, okCalls: 1, costUsd: 0.5 }) } })];
    render(<MemoryRouter><AiUsagePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByTestId('usage-row').length).toBe(2));
    expect(screen.getByText('$25.00')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText('paused')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume market.scan' }));
    await waitFor(() => expect(mockSetFeature).toHaveBeenCalledWith('market.scan', true));
    fireEvent.change(screen.getByLabelText('Monthly budget (USD)'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save budgets' }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ monthlyBudgetUsd: 250, dailyBudgetUsd: null }));
  });

  it('says plainly when nothing has been rolled up', async () => {
    days = [];
    render(<MemoryRouter><AiUsagePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('No AI usage has been rolled up yet')).toBeTruthy());
  });
});
