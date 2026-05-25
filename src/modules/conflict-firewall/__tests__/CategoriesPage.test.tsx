/**
 * CategoriesPage tests — Phase 6.UI.C.
 *
 * Stubs the service layer so the component test exercises the form
 * validation + submit flow without touching Firestore.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribe = vi.fn();
const mockAddCategory = vi.fn();

vi.mock('../services/conflict-firewall.service', () => ({
  subscribeCategories: (cb: (rows: unknown[]) => void) => {
    mockSubscribe(cb);
    return () => {};
  },
  addCategoryFn: (input: unknown) => mockAddCategory(input),
}));

import CategoriesPage from '../pages/CategoriesPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <CategoriesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockSubscribe.mockClear();
  mockAddCategory.mockReset();
  mockAddCategory.mockResolvedValue({ data: { id: 'TEST', created: true } });
});

describe('CategoriesPage', () => {
  it('renders the empty state when no categories exist', async () => {
    renderPage();
    expect(await screen.findByTestId('categories-empty')).toBeDefined();
  });

  it('renders a row per category from the subscription', async () => {
    renderPage();
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    const cb = mockSubscribe.mock.calls[0][0] as (rows: unknown[]) => void;
    cb([
      { id: 'CARBONATED_BEVERAGE', name: 'Carbonated Beverage', isActive: true },
      { id: 'COMMERCIAL_BANK',     name: 'Commercial Bank',     isActive: true },
    ]);
    await waitFor(() => expect(screen.queryByTestId('category-row-CARBONATED_BEVERAGE')).not.toBeNull());
    expect(screen.queryByTestId('category-row-COMMERCIAL_BANK')).not.toBeNull();
  });

  it('disables the submit button until id and name are filled', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('add-category-btn'));
    const submit = screen.getByTestId('submit-category-btn') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('category-id-input'), { target: { value: 'NEW_CAT' } });
    fireEvent.change(screen.getByTestId('category-name-input'), { target: { value: 'New Category' } });
    expect(submit.disabled).toBe(false);
  });

  it('submits and calls addCategoryFn with the entered fields (name trimmed)', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('add-category-btn'));
    fireEvent.change(screen.getByTestId('category-id-input'), { target: { value: 'NEW_CAT' } });
    fireEvent.change(screen.getByTestId('category-name-input'), { target: { value: '  New Category  ' } });
    fireEvent.click(screen.getByTestId('submit-category-btn'));
    await waitFor(() => expect(mockAddCategory).toHaveBeenCalledTimes(1));
    expect(mockAddCategory).toHaveBeenCalledWith({
      id: 'NEW_CAT',
      name: 'New Category',
      description: undefined,
    });
  });

  it('uppercases and slug-cleans the id input as the user types', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('add-category-btn'));
    const idInput = screen.getByTestId('category-id-input') as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: 'soft drinks!' } });
    expect(idInput.value).toBe('SOFT_DRINKS_');
  });
});
