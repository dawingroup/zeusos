/**
 * MemoEditorPage — a new memo starts from the type's template; an existing
 * draft offers "Draft with AI" per section, whose text lands in the card
 * unsaved; without a key the callable's sentence is shown in place.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { Memo } from '../types/memo';

const mockUseMemoDoc = vi.fn();
const mockDraft = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../hooks/useMemoDoc', () => ({ useMemoDoc: () => mockUseMemoDoc() }));
vi.mock('../hooks/useMemoActor', () => ({ useMemoActor: () => ({ actor: { uid: 'u-author', name: 'Amina Author', email: 'a@zeus.co.ke' }, isAdmin: false, loading: false }) }));
vi.mock('@/contexts/SubsidiaryContext', () => ({ useSubsidiary: () => ({ currentSubsidiary: { id: 'zeus-the-agency', name: 'Zeus The Agency' } }) }));
vi.mock('../services/memoService', () => ({
  createMemoDraft: vi.fn(),
  updateMemoDraft: (...a: unknown[]) => mockUpdate(...a),
  addMemoAttachment: vi.fn(),
  removeMemoAttachment: vi.fn(),
  loadMemoRoutingConfig: vi.fn().mockResolvedValue({ version: 0, modules: {} }),
}));
vi.mock('../services/memoActions', () => ({
  submitMemo: vi.fn(),
  draftMemoSection: (...a: unknown[]) => mockDraft(...a),
}));
vi.mock('@/shared/people', () => ({
  EmployeePicker: () => <div data-testid="employee-picker" />,
}));
vi.mock('@/shared/components/feedback', () => ({ pushToast: vi.fn() }));

import MemoEditorPage from '../pages/MemoEditorPage';

const DRAFT: Memo = {
  id: 'm1',
  subsidiaryId: 'zeus-the-agency',
  type: 'request',
  category: 'finance',
  impact: 'medium',
  confidential: false,
  subject: 'Generator hire',
  header: { to: [{ uid: 'u-grace', name: 'Grace Admin' }], from: { uid: 'u-author', name: 'Amina Author' }, through: [], cc: [], date: '2026-10-29' },
  amountMinor: 180000,
  currency: 'KES',
  sections: [
    { key: 'purpose', heading: 'Purpose', content: '', enabled: true },
    { key: 'recommendation', heading: 'Request', content: 'Approve the hire.', enabled: true },
  ],
  attachments: [],
  links: [],
  distribution: [],
  distributionUids: [],
  acknowledgements: {},
  status: 'draft',
  statusHistory: [],
  version: 0,
  createdBy: 'u-author',
  createdByName: 'Amina Author',
  createdAt: '2026-10-29T08:00:00.000Z',
  updatedAt: '2026-10-29T08:00:00.000Z',
  updatedBy: 'u-author',
};

function renderAt(path: string, memo: Memo | null) {
  mockUseMemoDoc.mockReturnValue({ memo, loading: false, error: null });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/memos/new" element={<MemoEditorPage />} />
        <Route path="/memos/:memoId/edit" element={<MemoEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockDraft.mockReset();
  mockUpdate.mockReset();
});

describe('MemoEditorPage', () => {
  it('a new memo starts from the request template with no AI until it is saved', () => {
    renderAt('/memos/new', null);
    expect(screen.getByText('Save the draft first')).toBeTruthy();
    expect(screen.getByLabelText('Purpose')).toBeTruthy();
    expect(screen.getByLabelText('Request')).toBeTruthy();
    expect(screen.queryByTestId('draft-section-ai')).toBeNull();
    expect(screen.getByText(/To a decider picked by role/)).toBeTruthy();
  });

  it('an existing draft offers Draft / Improve with AI per section; the text lands in the card', async () => {
    mockDraft.mockResolvedValue({ sectionKey: 'purpose', content: 'We request approval to hire a generator for [weeks] weeks.', characters: 60, linkedRecordsUsed: 0, model: 'm' });
    renderAt('/memos/m1/edit', DRAFT);
    expect(screen.getByRole('button', { name: 'Draft with AI' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Improve with AI' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }));
    fireEvent.change(screen.getByLabelText('Instruction for the draft'), { target: { value: 'Mention six weeks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    await waitFor(() => expect(mockDraft).toHaveBeenCalledWith({
      memoId: 'm1',
      sectionKey: 'purpose',
      hint: expect.stringContaining('Lead with the ask'),
      typeHint: expect.stringContaining('Justifies a spend'),
      instruction: 'Mention six weeks',
    }));
    await waitFor(() => expect((screen.getByLabelText('Purpose') as HTMLTextAreaElement).value).toBe('We request approval to hire a generator for [weeks] weeks.'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('without a key the callable\'s sentence is shown in place and the section stays by hand', async () => {
    const err = Object.assign(new Error('AI drafting needs an Anthropic key — set ANTHROPIC_API_KEY in Settings → API Keys. You can still write the section by hand.'), { code: 'functions/failed-precondition' });
    mockDraft.mockRejectedValue(err);
    renderAt('/memos/m1/edit', DRAFT);
    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    await waitFor(() => expect(screen.getByText(/needs an Anthropic key/)).toBeTruthy());
    expect((screen.getByLabelText('Purpose') as HTMLTextAreaElement).value).toBe('');
  });
});
