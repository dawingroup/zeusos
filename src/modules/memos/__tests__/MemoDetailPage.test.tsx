/**
 * MemoDetailPage — who sees which panel: the Through party whose turn it is
 * gets the clearance panel; an addressee gets the decision panel once cleared;
 * the author gets neither, only where it is; the issued memo offers the PDF.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { Memo } from '../types/memo';

const mockUseMemoDoc = vi.fn();
const mockUseMemoActor = vi.fn();
const mockClearMemo = vi.fn();
const mockDecideMemo = vi.fn();
const mockIssueMemo = vi.fn();

vi.mock('../hooks/useMemoDoc', () => ({ useMemoDoc: () => mockUseMemoDoc() }));
vi.mock('../hooks/useMemoActor', () => ({ useMemoActor: () => mockUseMemoActor() }));
vi.mock('../hooks/useMemoComments', () => ({ useMemoComments: () => ({ comments: [], error: null }) }));
vi.mock('../services/memoActions', () => ({
  clearMemo: (...a: unknown[]) => mockClearMemo(...a),
  decideMemo: (...a: unknown[]) => mockDecideMemo(...a),
  issueMemo: (...a: unknown[]) => mockIssueMemo(...a),
  reopenMemo: vi.fn(),
  withdrawMemo: vi.fn(),
  acknowledgeMemo: vi.fn(),
  fileMemoPdf: vi.fn(),
}));
vi.mock('../services/memoService', () => ({ draftReplacementMemo: vi.fn(), issuedMemoPdfPath: vi.fn() }));
vi.mock('../services/memoCommentService', () => ({ addMemoComment: vi.fn(), subscribeToMemoComments: vi.fn() }));
vi.mock('../pdf/memoPdf', () => ({ renderAndFileIssuedMemoPdf: vi.fn().mockResolvedValue({}), openMemoPdfPreview: vi.fn() }));
vi.mock('@/shared/components/feedback', () => ({ pushToast: vi.fn() }));

import MemoDetailPage from '../pages/MemoDetailPage';

const MEMO: Memo = {
  id: 'm1',
  memoNumber: 'MEMO-ZTA-2026-001',
  subsidiaryId: 'zeus-the-agency',
  type: 'request',
  category: 'finance',
  impact: 'medium',
  confidential: false,
  subject: 'Generator hire for the Diageo shoot',
  header: { to: [{ uid: 'u-grace', name: 'Grace Admin' }], from: { uid: 'u-author', name: 'Amina Author' }, through: [{ uid: 'u-ben', name: 'Ben Through' }], cc: [], date: '2026-10-26' },
  amountMinor: 180000,
  currency: 'KES',
  sections: [{ key: 'purpose', heading: 'Purpose', content: 'Hire a generator for six weeks.', enabled: true }],
  attachments: [],
  links: [],
  distribution: [{ uid: 'u-cc', name: 'Carol Copy', role: 'ack', requiresAck: true }],
  distributionUids: ['u-cc'],
  routeUids: ['u-ben', 'u-grace'],
  acknowledgements: {},
  status: 'submitted',
  statusHistory: [{ from: null, to: 'draft', by: 'u-author', byName: 'Amina Author', at: '2026-10-26T08:00:00.000Z' }, { from: 'draft', to: 'submitted', by: 'u-author', byName: 'Amina Author', at: '2026-10-26T09:00:00.000Z' }],
  version: 1,
  approval: {
    required: true, entityType: 'memo_finance', bandRole: null, impactMinimumRole: 'manager', typeMinimumRole: 'manager', effectiveRole: 'manager',
    roleChain: ['manager', 'admin', 'owner'], raisedBy: 'impact', evaluatedAt: '2026-10-26T09:00:00.000Z',
    route: { source: 'addressed', clearance: [{ uid: 'u-ben', name: 'Ben Through' }], deciders: [{ uid: 'u-grace', name: 'Grace Admin' }] },
    stage: 'clearance', clearanceIndex: 0, clearanceUids: ['u-ben'], deciderUids: ['u-grace'], clearances: [],
  },
  createdBy: 'u-author',
  createdByName: 'Amina Author',
  createdAt: '2026-10-26T08:00:00.000Z',
  updatedAt: '2026-10-26T09:00:00.000Z',
  updatedBy: 'u-author',
};

const actor = (uid: string, name: string, isAdmin = false) => ({ actor: { uid, name }, isAdmin, loading: false });

function renderPage(memo: Memo | null) {
  mockUseMemoDoc.mockReturnValue({ memo, loading: false, error: null });
  return render(
    <MemoryRouter initialEntries={['/memos/m1']}>
      <Routes><Route path="/memos/:memoId" element={<MemoDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockClearMemo.mockReset();
  mockDecideMemo.mockReset();
  mockIssueMemo.mockReset();
});

describe('MemoDetailPage', () => {
  it('the Through party whose turn it is sees the clearance panel and clears through the callable', async () => {
    mockUseMemoActor.mockReturnValue(actor('u-ben', 'Ben Through'));
    mockClearMemo.mockResolvedValue({ id: 'm1', status: 'submitted', stage: 'decision' });
    renderPage(MEMO);
    expect(screen.getByTestId('memo-clearance-panel')).toBeTruthy();
    expect(screen.queryByTestId('memo-decision-panel')).toBeNull();
    expect(screen.getByText(/With Ben Through to clear/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(mockClearMemo).toHaveBeenCalledWith('m1', 'cleared', ''));
  });

  it('the addressee sees nothing to do until it is cleared, then decides by typing their name', async () => {
    mockUseMemoActor.mockReturnValue(actor('u-grace', 'Grace Admin'));
    const { unmount } = renderPage(MEMO);
    expect(screen.queryByTestId('memo-decision-panel')).toBeNull();
    expect(screen.queryByTestId('memo-clearance-panel')).toBeNull();
    unmount();

    mockDecideMemo.mockResolvedValue({ id: 'm1', status: 'approved', outcome: 'approved' });
    mockIssueMemo.mockResolvedValue({ id: 'm1', status: 'issued' });
    const cleared: Memo = { ...MEMO, approval: { ...MEMO.approval!, stage: 'decision', clearanceIndex: 1, clearances: [{ uid: 'u-ben', name: 'Ben Through', outcome: 'cleared', at: '2026-10-26T10:00:00.000Z' }] } };
    renderPage(cleared);
    expect(screen.getByTestId('memo-decision-panel')).toBeTruthy();
    expect(screen.getByText(/Addressed to you/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const sign = await screen.findByLabelText('Type your name to sign');
    expect((screen.getByRole('button', { name: 'Sign & approve' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(sign, { target: { value: 'Grace Admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign & approve' }));
    await waitFor(() => expect(mockDecideMemo).toHaveBeenCalledWith('m1', { outcome: 'approved', conditions: undefined, notes: undefined, signedName: 'Grace Admin' }));
    // Decided → issued in the same breath.
    await waitFor(() => expect(mockIssueMemo).toHaveBeenCalledWith('m1'));
  });

  it('the author sees where it is, and neither panel', () => {
    mockUseMemoActor.mockReturnValue(actor('u-author', 'Amina Author'));
    renderPage(MEMO);
    expect(screen.queryByTestId('memo-clearance-panel')).toBeNull();
    expect(screen.queryByTestId('memo-decision-panel')).toBeNull();
    expect(screen.getByText(/You wrote this memo, so somebody else must clear and decide it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Issue memo/ })).toBeNull();
  });

  it('an issued memo without a filed PDF offers to render and file it; with one, to download it', () => {
    mockUseMemoActor.mockReturnValue(actor('u-author', 'Amina Author'));
    const snap = { memoNumber: 'MEMO-ZTA-2026-001', version: 1, header: MEMO.header, sections: MEMO.sections, links: [], attachments: [], distribution: MEMO.distribution, contentHash: 'abc', issuedAt: '2026-10-27T11:00:00.000Z', issuedBy: 'u-author' };
    const { unmount } = renderPage({ ...MEMO, status: 'issued', issuedSnapshot: snap });
    expect(screen.getByRole('button', { name: /Render & file PDF/ })).toBeTruthy();
    expect(screen.getByText(/sha256 abc/)).toBeTruthy();
    unmount();
    renderPage({ ...MEMO, status: 'issued', issuedSnapshot: { ...snap, pdfUrl: 'https://x/pdf' } });
    expect(screen.getByRole('link', { name: /Download PDF/ }).getAttribute('href')).toBe('https://x/pdf');
  });

  it('a memo that cannot be read is not a blank page', () => {
    mockUseMemoActor.mockReturnValue(actor('u-x', 'X'));
    renderPage(null);
    expect(screen.getByText('Memo not found')).toBeTruthy();
  });
});
