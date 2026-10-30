/**
 * NotificationCenter — opening a notice marks it read and goes where it says;
 * archived, expired, message-type and muted notices are left out.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { GlobalNotification } from '@/integration/types';

const mockMarkRead = vi.fn();
const mockMarkAll = vi.fn();
const mockNavigate = vi.fn();
let items: GlobalNotification[] = [];
let muted: string[] = [];

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/integration/store', () => ({
  useNotifications: () => ({ items, unreadCount: items.filter((n) => !n.isRead).length, markNotificationRead: mockMarkRead, markAllNotificationsRead: mockMarkAll }),
  usePreferences: () => ({ preferences: { notificationSettings: { mutedModules: muted } }, updatePreferences: vi.fn() }),
}));

import { NotificationCenter } from '../NotificationCenter';

const notice = (over: Partial<GlobalNotification> & { id: string }): GlobalNotification => ({
  type: 'task.assigned', title: over.id, message: '', module: 'intelligence', priority: 'medium', severity: 'info',
  isRead: false, isArchived: false, createdAt: null, ...over,
});

describe('NotificationCenter', () => {
  it('lists the bell notices only, opens one by marking it read and navigating', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    items = [
      notice({ id: 'open-me', actionUrl: '/memos/m1', module: 'memos' }),
      notice({ id: 'archived', isArchived: true }),
      notice({ id: 'expired', expiresAt: past }),
      notice({ id: 'a message', type: 'message' }),
      notice({ id: 'already read', isRead: true }),
    ];
    muted = [];
    render(<MemoryRouter><NotificationCenter open onOpenChange={vi.fn()} /></MemoryRouter>);
    const rows = screen.getAllByTestId('notice-row');
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('open-me'), expect.stringContaining('already read')]);
    expect(screen.getByTestId('notification-center-unread').textContent).toBe('1');
    fireEvent.click(rows[0]);
    expect(mockMarkRead).toHaveBeenCalledWith('open-me');
    expect(mockNavigate).toHaveBeenCalledWith('/memos/m1');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(mockMarkAll).toHaveBeenCalled();
  });

  it('hides a muted module and says when nothing is left', () => {
    items = [notice({ id: 'memo', module: 'memos' })];
    muted = ['memos'];
    render(<MemoryRouter><NotificationCenter open onOpenChange={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByTestId('notice-row')).toBeNull();
    expect(screen.getAllByText(/all caught up/).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('notification-center-unread')).toBeNull();
  });
});
