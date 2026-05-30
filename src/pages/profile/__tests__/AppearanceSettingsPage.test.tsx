/**
 * AppearanceSettingsPage — Phase 5 render tests.
 *
 * Asserts the page exposes exactly Theme · Density · Accent and that the
 * design `direction` / `sidebarStyle` axes are NOT user-exposed (product
 * decision), and that clicking a control writes through to uiStore.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import AppearanceSettingsPage from '../AppearanceSettingsPage';
import { useUIStore } from '@/shared/stores/uiStore';

function renderPage() {
  return render(
    <MemoryRouter>
      <AppearanceSettingsPage />
    </MemoryRouter>,
  );
}

describe('AppearanceSettingsPage', () => {
  beforeEach(() => {
    // Reset relevant store fields to known defaults.
    useUIStore.setState({ theme: 'light', density: 'balanced', accent: 'zeus-navy' });
  });

  it('renders the three control groups (theme, density, accent)', () => {
    const { container } = renderPage();
    expect(screen.getByTestId('theme-light')).toBeTruthy();
    expect(screen.getByTestId('theme-dark')).toBeTruthy();
    expect(screen.getByTestId('theme-system')).toBeTruthy();
    expect(screen.getByTestId('density-dense')).toBeTruthy();
    expect(screen.getByTestId('density-balanced')).toBeTruthy();
    expect(screen.getByTestId('density-airy')).toBeTruthy();
    expect(screen.getByTestId('accent-zeus-navy')).toBeTruthy();
    expect(screen.getByTestId('accent-house-of-zeus')).toBeTruthy();
    // Exactly 7 accent swatches.
    expect(container.querySelectorAll('[data-testid^="accent-"]').length).toBe(7);
  });

  it('does NOT expose a design-direction or sidebar-style control', () => {
    const { container } = renderPage();
    expect(container.querySelector('[data-testid^="direction-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="sidebar-"]')).toBeNull();
    expect(screen.queryByText(/ambitious/i)).toBeNull();
    expect(screen.queryByText(/conservative/i)).toBeNull();
  });

  it('writes theme / density / accent through to uiStore on click', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('theme-dark'));
    expect(useUIStore.getState().theme).toBe('dark');
    fireEvent.click(screen.getByTestId('density-dense'));
    expect(useUIStore.getState().density).toBe('dense');
    fireEvent.click(screen.getByTestId('accent-labyrinth'));
    expect(useUIStore.getState().accent).toBe('labyrinth');
    // direction stays locked regardless of any interaction.
    expect(useUIStore.getState().direction).toBe('ambitious');
  });
});
