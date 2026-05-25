/**
 * CategoryPickerDialog tests — Phase 6.UI.C.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribe = vi.fn();

vi.mock('../services/conflict-firewall.service', () => ({
  subscribeCategories: (cb: (rows: unknown[]) => void) => {
    mockSubscribe(cb);
    return () => {};
  },
}));

import { CategoryPickerDialog } from '../components/CategoryPickerDialog';

beforeEach(() => {
  mockSubscribe.mockClear();
});

function seed(cb: (rows: unknown[]) => void) {
  cb([
    { id: 'CARBONATED_BEVERAGE', name: 'Carbonated Beverage', isActive: true },
    { id: 'COMMERCIAL_BANK',     name: 'Commercial Bank',     isActive: true },
    { id: 'INACTIVE_CAT',        name: 'Old Category',        isActive: false },
  ]);
}

describe('CategoryPickerDialog', () => {
  it('does not render anything when closed', () => {
    render(<CategoryPickerDialog open={false} onClose={() => {}} onPick={() => {}} />);
    expect(screen.queryByTestId('category-picker-dialog')).toBeNull();
  });

  it('renders rows from subscription when open', async () => {
    render(<CategoryPickerDialog open onClose={() => {}} onPick={() => {}} />);
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    seed(mockSubscribe.mock.calls[0][0] as (rows: unknown[]) => void);
    await waitFor(() => {
      expect(screen.queryByTestId('category-picker-option-CARBONATED_BEVERAGE')).not.toBeNull();
    });
    expect(screen.queryByTestId('category-picker-option-COMMERCIAL_BANK')).not.toBeNull();
  });

  it('filters the list against the search input', async () => {
    render(<CategoryPickerDialog open onClose={() => {}} onPick={() => {}} />);
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    seed(mockSubscribe.mock.calls[0][0] as (rows: unknown[]) => void);
    await waitFor(() =>
      expect(screen.queryByTestId('category-picker-option-CARBONATED_BEVERAGE')).not.toBeNull(),
    );
    fireEvent.change(screen.getByTestId('category-picker-filter'), {
      target: { value: 'bank' },
    });
    expect(screen.queryByTestId('category-picker-option-COMMERCIAL_BANK')).not.toBeNull();
    expect(screen.queryByTestId('category-picker-option-CARBONATED_BEVERAGE')).toBeNull();
  });

  it('fires onPick with the chosen categoryId and exclusive=true by default', async () => {
    const onPick = vi.fn();
    render(<CategoryPickerDialog open showExclusiveToggle onClose={() => {}} onPick={onPick} />);
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    seed(mockSubscribe.mock.calls[0][0] as (rows: unknown[]) => void);
    await waitFor(() =>
      expect(screen.queryByTestId('category-picker-option-CARBONATED_BEVERAGE')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('category-picker-option-CARBONATED_BEVERAGE'));
    expect(onPick).toHaveBeenCalledWith('CARBONATED_BEVERAGE', { exclusive: true });
  });

  it('respects the exclusive checkbox when surfacing onPick', async () => {
    const onPick = vi.fn();
    render(<CategoryPickerDialog open showExclusiveToggle onClose={() => {}} onPick={onPick} />);
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    seed(mockSubscribe.mock.calls[0][0] as (rows: unknown[]) => void);
    await waitFor(() =>
      expect(screen.queryByTestId('category-picker-option-CARBONATED_BEVERAGE')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('category-picker-exclusive')); // toggle off
    fireEvent.click(screen.getByTestId('category-picker-option-CARBONATED_BEVERAGE'));
    expect(onPick).toHaveBeenCalledWith('CARBONATED_BEVERAGE', { exclusive: false });
  });

  it('disables inactive category rows', async () => {
    render(<CategoryPickerDialog open onClose={() => {}} onPick={() => {}} />);
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    seed(mockSubscribe.mock.calls[0][0] as (rows: unknown[]) => void);
    await waitFor(() =>
      expect(screen.queryByTestId('category-picker-option-INACTIVE_CAT')).not.toBeNull(),
    );
    const btn = screen.getByTestId('category-picker-option-INACTIVE_CAT') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
