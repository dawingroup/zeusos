import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockUpdate = vi.fn();
vi.mock('@/integration/store', () => ({
  usePreferences: () => ({
    preferences: { notificationSettings: { email: true, push: true, inApp: true, digest: 'daily', mutedModules: ['memos'] } },
    updatePreferences: mockUpdate,
  }),
}));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));

import NotificationSettingsPage from '../NotificationSettingsPage';

describe('NotificationSettingsPage', () => {
  it('shows one switch per mutable module and saves the muted list on toggle', () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const memos = screen.getByRole('switch', { name: 'Show Memos in the bell' });
    const tasks = screen.getByRole('switch', { name: 'Show Tasks & daily plans in the bell' });
    expect(memos.getAttribute('aria-checked')).toBe('false');
    expect(tasks.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(tasks);
    expect(mockUpdate).toHaveBeenCalledWith({ notificationSettings: { email: true, push: true, inApp: true, digest: 'daily', mutedModules: ['memos', 'intelligence'] } });
    fireEvent.click(memos);
    expect(mockUpdate).toHaveBeenLastCalledWith({ notificationSettings: { email: true, push: true, inApp: true, digest: 'daily', mutedModules: [] } });
  });
});
