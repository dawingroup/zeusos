/**
 * AddTimeEntryDialog tests — Phase 5.D follow-up.
 *
 * The dialog opens from `/time`'s "Add entry" button. It wraps a
 * postTimeEntryFn call with the four required fields (iwoId, userId,
 * minutes, entryDate) plus an optional note. The IWO picker switches
 * between a <select> (when recentIwoIds is non-empty) and a free-text
 * Input (when the user hasn't logged time anywhere yet this week).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';

const mockPost = vi.fn();

vi.mock('@/modules/delivery/services/firebase', () => ({
  postTimeEntryFn: (input: unknown) => mockPost(input),
}));

import { AddTimeEntryDialog } from '../components/AddTimeEntryDialog';

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { timeEntryId: 'te_new', iwoId: 'iwo_a', cumulativeCostMinor: 1000 } });
});

describe('AddTimeEntryDialog', () => {
  it('open=false renders nothing', () => {
    const { container } = render(
      <AddTimeEntryDialog
        open={false}
        onClose={() => {}}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true with recentIwoIds renders a <select> picker', () => {
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={() => {}}
        userId="u_1"
        recentIwoIds={['iwo_a', 'iwo_b']}
      />,
    );
    const picker = screen.getByTestId('add-time-entry-iwo-input');
    expect(picker.tagName).toBe('SELECT');
    expect(picker.textContent).toContain('iwo_a');
    expect(picker.textContent).toContain('iwo_b');
  });

  it('open=true with no recentIwoIds falls back to a free-text input', () => {
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={() => {}}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    const picker = screen.getByTestId('add-time-entry-iwo-input');
    expect(picker.tagName).toBe('INPUT');
  });

  it('submit is disabled until iwoId + minutes are filled', () => {
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={() => {}}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    const btn = screen.getByTestId('add-time-entry-submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('add-time-entry-iwo-input'), { target: { value: 'iwo_x' } });
    expect(btn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '30' } });
    expect(btn.disabled).toBe(false);
  });

  it('rejects 0 / negative / non-numeric minutes (keeps button disabled)', () => {
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={() => {}}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    fireEvent.change(screen.getByTestId('add-time-entry-iwo-input'), { target: { value: 'iwo_x' } });
    const btn = screen.getByTestId('add-time-entry-submit-btn') as HTMLButtonElement;
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '0' } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '-5' } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: 'abc' } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '45' } });
    expect(btn.disabled).toBe(false);
  });

  it('submit calls postTimeEntryFn with the trimmed payload + closes', async () => {
    const onClose = vi.fn();
    const onPosted = vi.fn();
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={onClose}
        userId="u_42"
        recentIwoIds={[]}
        onPosted={onPosted}
      />,
    );
    fireEvent.change(screen.getByTestId('add-time-entry-iwo-input'), { target: { value: '  iwo_abc  ' } });
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '60' } });
    fireEvent.change(screen.getByTestId('add-time-entry-note-input'), { target: { value: '  brief alignment  ' } });
    fireEvent.click(screen.getByTestId('add-time-entry-submit-btn'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const call = mockPost.mock.calls[0][0] as Record<string, unknown>;
    expect(call.iwoId).toBe('iwo_abc');           // trimmed
    expect(call.userId).toBe('u_42');
    expect(call.minutes).toBe(60);
    expect(call.note).toBe('brief alignment');    // trimmed
    expect(typeof call.entryDate).toBe('string');

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onPosted).toHaveBeenCalledWith('te_new');
  });

  it('empty note is sent as undefined (not empty string)', async () => {
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={() => {}}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    fireEvent.change(screen.getByTestId('add-time-entry-iwo-input'), { target: { value: 'iwo_x' } });
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '30' } });
    // Leave note empty.
    fireEvent.click(screen.getByTestId('add-time-entry-submit-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const call = mockPost.mock.calls[0][0] as Record<string, unknown>;
    expect(call.note).toBeUndefined();
  });

  it('FirebaseError surfaces as `code: message` in the alert region (dialog stays open)', async () => {
    const onClose = vi.fn();
    mockPost.mockRejectedValue(new FirebaseError('failed-precondition', 'budget exhausted'));
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={onClose}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    fireEvent.change(screen.getByTestId('add-time-entry-iwo-input'), { target: { value: 'iwo_x' } });
    fireEvent.change(screen.getByTestId('add-time-entry-minutes-input'), { target: { value: '30' } });
    fireEvent.click(screen.getByTestId('add-time-entry-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('add-time-entry-error')).toBeTruthy();
    });
    expect(screen.getByTestId('add-time-entry-error').textContent).toMatch(/failed-precondition: budget exhausted/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('close button + backdrop click both fire onClose', () => {
    const onClose = vi.fn();
    render(
      <AddTimeEntryDialog
        open={true}
        onClose={onClose}
        userId="u_1"
        recentIwoIds={[]}
      />,
    );
    fireEvent.click(screen.getByTestId('add-time-entry-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('add-time-entry-dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
