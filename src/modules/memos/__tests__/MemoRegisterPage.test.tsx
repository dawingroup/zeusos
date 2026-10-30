/**
 * MemoRegisterPage — the register merges the brand's memos with those
 * addressed to me or on my route; "Awaiting me" is only what is waiting on
 * ME; a load fault is not an empty register.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { Memo, MemoFilters } from '../types/memo';

const lists: Record<string, Memo[]> = {};
let loadError: Error | null = null;

vi.mock('../hooks/useMemos', () => ({
  useMemos: (filters: MemoFilters) => {
    const key = filters.createdBy ? 'mine' : filters.recipientUid ? 'addressed' : filters.routeUid ? 'routed' : 'register';
    return { memos: lists[key] ?? [], loading: false, error: key === 'register' ? loadError : null };
  },
}));
vi.mock('../hooks/useMemoActor', () => ({ useMemoActor: () => ({ actor: { uid: 'me', name: 'Me' }, isAdmin: false, loading: false }) }));
vi.mock('@/contexts/SubsidiaryContext', () => ({ useSubsidiary: () => ({ currentSubsidiary: { id: 'zeus-the-agency', name: 'Zeus The Agency' } }) }));
vi.mock('../services/memoService', () => ({ deleteMemoDraft: vi.fn() }));

import MemoRegisterPage from '../pages/MemoRegisterPage';

function memo(over: Partial<Memo>): Memo {
  return {
    id: over.id ?? 'x',
    subsidiaryId: 'zeus-the-agency',
    type: 'request', category: 'finance', impact: 'low', confidential: false,
    subject: over.subject ?? 'A memo',
    header: { to: [], from: { uid: 'a', name: 'A' }, through: [], cc: [], date: '2026-10-26' },
    sections: [], attachments: [], links: [], distribution: [], distributionUids: [], acknowledgements: {},
    status: 'draft', statusHistory: [], version: 0,
    createdBy: 'a', createdByName: 'Author', createdAt: '2026-10-26T09:00:00.000Z', updatedAt: '2026-10-26T09:00:00.000Z', updatedBy: 'a',
    ...over,
  } as Memo;
}

const onRouteForMe = memo({
  id: 'r1', subject: 'Clear me', status: 'submitted', createdBy: 'b', routeUids: ['me'],
  approval: { required: true, entityType: 'memo_finance', bandRole: null, impactMinimumRole: null, typeMinimumRole: 'manager', effectiveRole: 'manager', roleChain: ['manager', 'admin', 'owner'], raisedBy: 'type', evaluatedAt: 'x', stage: 'clearance', clearanceIndex: 0, clearanceUids: ['me'], deciderUids: ['c'], clearances: [] },
});
const onRouteLater = memo({
  id: 'r2', subject: 'Not my turn yet', status: 'submitted', createdBy: 'b', routeUids: ['d', 'me'],
  approval: { required: true, entityType: 'memo_finance', bandRole: null, impactMinimumRole: null, typeMinimumRole: 'manager', effectiveRole: 'manager', roleChain: ['manager', 'admin', 'owner'], raisedBy: 'type', evaluatedAt: 'x', stage: 'clearance', clearanceIndex: 0, clearanceUids: ['d'], deciderUids: ['me'], clearances: [] },
});
const ackPending = memo({ id: 'k1', subject: 'Acknowledge me', status: 'issued', createdBy: 'b', distribution: [{ uid: 'me', name: 'Me', role: 'ack', requiresAck: true }], distributionUids: ['me'] });

describe('MemoRegisterPage', () => {
  it('the register merges brand memos with those addressed to me or on my route, once each', () => {
    lists.register = [memo({ id: 'g1', subject: 'Brand memo' }), onRouteForMe];
    lists.addressed = [ackPending];
    lists.routed = [onRouteForMe, onRouteLater];
    loadError = null;
    render(<MemoryRouter><MemoRegisterPage view="all" /></MemoryRouter>);
    const rows = screen.getAllByTestId('memo-row');
    expect(rows).toHaveLength(4);
    expect(screen.getByText('Brand memo')).toBeTruthy();
    expect(screen.getByText('Zeus The Agency', { exact: false })).toBeTruthy();
  });

  it('"Awaiting me" is my turn to clear, addressed to me to decide, or my acknowledgement — not a later turn', () => {
    lists.register = [];
    lists.addressed = [ackPending];
    lists.routed = [onRouteForMe, onRouteLater];
    render(<MemoryRouter><MemoRegisterPage view="awaiting" /></MemoryRouter>);
    expect(screen.getByText('Clear me')).toBeTruthy();
    expect(screen.getByText('Acknowledge me')).toBeTruthy();
    expect(screen.queryByText('Not my turn yet')).toBeNull();
  });

  it('a load fault shows the fault, not "No memos yet"', () => {
    lists.register = [];
    lists.addressed = [];
    lists.routed = [];
    loadError = new Error('permission-denied');
    render(<MemoryRouter><MemoRegisterPage view="all" /></MemoryRouter>);
    expect(screen.getByText('Could not load memos')).toBeTruthy();
    expect(screen.getByText('permission-denied')).toBeTruthy();
  });
});
