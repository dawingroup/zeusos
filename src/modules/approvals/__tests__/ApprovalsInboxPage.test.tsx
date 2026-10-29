/**
 * ApprovalsInboxPage — render tests. The hook and the action map are mocked;
 * what is under test is the presenter: scope copy, urgency strip, rows,
 * Approve → action → toast, Reject → note → confirm, self-raised rows, and
 * the degraded-feed notice.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApprovalItem } from '../types';

const hookState: {
  items: ApprovalItem[];
  loading: boolean;
  error: Error | null;
  degraded: string[];
  resubscribe: () => void;
} = { items: [], loading: false, error: null, degraded: [], resubscribe: vi.fn() };

const currentUser: { dawinUser: { uid: string; globalRole: string; subsidiaryAccess: unknown[] } | null } = {
  dawinUser: { uid: 'u_am', globalRole: 'admin', subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }] },
};

vi.mock('@/core/settings', () => ({
  useCurrentDawinUser: () => currentUser,
}));
vi.mock('../hooks/useApprovalsInbox', () => ({
  useApprovalsInbox: () => hookState,
}));
vi.mock('@/shared/people', () => ({
  PersonName: ({ id }: { id: string }) => <span data-testid="person">{id}</span>,
}));
const pushToast = vi.fn();
vi.mock('@/shared/components/feedback/toastBus', () => ({
  pushToast: (...args: unknown[]) => pushToast(...args),
}));

const approveRun = vi.fn(async (_item: ApprovalItem, _ctx: { actorUserId: string }) => {});
const rejectRun = vi.fn(async (_item: ApprovalItem, _note: string, _ctx: { actorUserId: string }) => {});
vi.mock('../approvalActions', () => ({
  actionsFor: (item: ApprovalItem) =>
    item.decision === 'inline'
      ? {
          approve: { label: 'Approve', run: approveRun },
          reject: { label: 'Reject', notePrompt: 'Why?', run: rejectRun },
        }
      : {},
}));

import ApprovalsInboxPage from '../pages/ApprovalsInboxPage';

function item(overrides: Partial<ApprovalItem>): ApprovalItem {
  return {
    id: 'sow:s1',
    kind: 'sow_approval',
    title: 'SOW SOW-ACME — Brand refresh',
    requiredAction: 'approve_sow',
    urgency: 'medium',
    status: 'PENDING_APPROVAL',
    entity: { type: 'sow', id: 's1', ref: 'SOW-ACME', clientId: 'c1', msaId: 'm1' },
    amountMinor: 80_000_000,
    currency: 'UGX',
    daysPending: 2,
    decision: 'inline',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ApprovalsInboxPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hookState.items = [];
  hookState.loading = false;
  hookState.error = null;
  hookState.degraded = [];
  pushToast.mockClear();
  approveRun.mockClear();
  rejectRun.mockClear();
  currentUser.dawinUser = {
    uid: 'u_am',
    globalRole: 'admin',
    subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }],
  };
});

describe('ApprovalsInboxPage', () => {
  it('shows the empty state and a zeroed urgency strip for a parent principal with nothing waiting', () => {
    renderPage();
    expect(screen.getByTestId('approvals-scope-note').textContent).toMatch(/across the group/);
    expect(screen.getByTestId('approvals-empty')).toBeTruthy();
    expect(screen.getByTestId('approvals-count-critical').textContent).toBe('0');
  });

  it('renders rows with urgency, amount, requester, waiting and a link to the record', () => {
    hookState.items = [
      item({ requesterUserId: 'u_raiser', urgency: 'high' }),
      item({
        id: 'ecd:iwo1',
        kind: 'ecd_rung',
        title: 'IWO-1 — awaiting Creative Director',
        requiredAction: 'advance_approval_rung',
        urgency: 'critical',
        status: 'CD',
        entity: { type: 'iwo', id: 'iwo1', ref: 'IWO-1' },
        amountMinor: 1_000_000,
        currency: 'KES',
        brandId: 'zeus-the-agency',
        dueAtMs: Date.now() - 1000,
        daysPending: 9,
      }),
    ];
    renderPage();
    expect(screen.getByTestId('approvals-count-high').textContent).toBe('1');
    expect(screen.getByTestId('approvals-count-critical').textContent).toBe('1');
    const sowRow = screen.getByTestId('approval-row-sow:s1');
    expect(sowRow.textContent).toMatch(/SOW SOW-ACME/);
    expect(sowRow.textContent).toMatch(/u_raiser/);
    expect(sowRow.textContent).toMatch(/2d/);
    expect(sowRow.querySelector('a[href="/clients/c1/msas/m1/sows/s1"]')).toBeTruthy();
    const iwoRow = screen.getByTestId('approval-row-ecd:iwo1');
    expect(iwoRow.querySelector('[data-testid="approval-sla-passed"]')).toBeTruthy();
    expect(iwoRow.querySelector('a[href="/delivery/iwo/iwo1"]')).toBeTruthy();
    // Kind filter chips appear once more than one kind is present.
    expect(screen.getByTestId('approvals-kind-filter').textContent).toMatch(/SOW \(1\)/);
  });

  it('Approve runs the action with the signed-in uid and toasts success', async () => {
    hookState.items = [item({})];
    renderPage();
    fireEvent.click(screen.getByTestId('approve-sow:s1'));
    await waitFor(() => expect(approveRun).toHaveBeenCalledTimes(1));
    expect(approveRun.mock.calls[0][1]).toEqual({ actorUserId: 'u_am' });
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/Approve: SOW-ACME/), { tone: 'success' }));
  });

  it('Reject needs a note, then runs the action with it', async () => {
    hookState.items = [item({})];
    renderPage();
    fireEvent.click(screen.getByTestId('reject-sow:s1'));
    // Empty note is refused without calling anything.
    fireEvent.click(screen.getByTestId('reject-confirm-sow:s1'));
    expect(rejectRun).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith('A note is required to send this back.', { tone: 'error' });

    fireEvent.change(screen.getByLabelText('Rejection note'), { target: { value: 'Ceiling too high' } });
    fireEvent.click(screen.getByTestId('reject-confirm-sow:s1'));
    await waitFor(() => expect(rejectRun).toHaveBeenCalledTimes(1));
    expect(rejectRun.mock.calls[0][1]).toBe('Ceiling too high');
    expect(rejectRun.mock.calls[0][2]).toEqual({ actorUserId: 'u_am' });
  });

  it('surfaces a callable refusal as an error toast and keeps the row', async () => {
    approveRun.mockRejectedValueOnce(Object.assign(new Error('COMMERCIAL_SCOPE_REQUIRED: not a parent-org principal.'), { code: 'functions/permission-denied' }));
    hookState.items = [item({})];
    renderPage();
    fireEvent.click(screen.getByTestId('approve-sow:s1'));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/COMMERCIAL_SCOPE_REQUIRED/), { tone: 'error' }),
    );
    expect(screen.getByTestId('approval-row-sow:s1')).toBeTruthy();
  });

  it('a row the viewer raised offers no decision buttons (ADR-0002)', () => {
    hookState.items = [item({ requesterUserId: 'u_am' })];
    renderPage();
    expect(screen.getByTestId('approval-self-raised')).toBeTruthy();
    expect(screen.queryByTestId('approve-sow:s1')).toBeNull();
  });

  it('an open-only row (quote with the client) has a link but no buttons', () => {
    hookState.items = [
      item({ id: 'quote:q1', kind: 'quote_awaiting_client', decision: 'open_only', entity: { type: 'quote', id: 'q1', ref: 'Q-1' } }),
    ];
    renderPage();
    expect(screen.queryByTestId('approve-quote:q1')).toBeNull();
    expect(screen.getByTestId('approval-row-quote:q1').querySelector('a[href="/pricing/quotes/q1"]')).toBeTruthy();
  });

  it('names refused feeds instead of blanking the page', () => {
    hookState.degraded = ['sows', 'quotes'];
    hookState.items = [item({ id: 'ecd:i', kind: 'ecd_rung', entity: { type: 'iwo', id: 'i' }, brandId: 'labyrinth' })];
    renderPage();
    expect(screen.getByTestId('approvals-degraded').textContent).toMatch(/SOWs, quotes/);
    expect(screen.getByTestId('approval-row-ecd:i')).toBeTruthy();
  });

  it('brand scope copy for a subsidiary member; no-scope copy for a user without org access', () => {
    currentUser.dawinUser = { uid: 'u_b', globalRole: 'member', subsidiaryAccess: [{ subsidiaryId: 'labyrinth', hasAccess: true, modules: [] }] };
    const { unmount } = renderPage();
    expect(screen.getByTestId('approvals-scope-note').textContent).toMatch(/Your brand/);
    unmount();

    currentUser.dawinUser = { uid: 'u_n', globalRole: 'member', subsidiaryAccess: [] };
    renderPage();
    expect(screen.getByTestId('approvals-scope-note').textContent).toMatch(/No approvals scope/);
    expect(screen.queryByTestId('approvals-summary')).toBeNull();
  });
});
