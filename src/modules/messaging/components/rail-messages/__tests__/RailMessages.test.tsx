/**
 * Messages in the rail. What must hold:
 *  - unread first, capped, with a search that reaches everything;
 *  - showing the list never marks anything read; opening a thread does;
 *  - Esc in a thread goes back to the list, never closes the rail;
 *  - a failed send keeps what was typed and says so;
 *  - pop-out docks the thread and closes an overlay rail.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  channels: { current: {} as Record<string, unknown> },
  openThread: vi.fn(),
  markChannelRead: vi.fn().mockResolvedValue(undefined),
  sendChatMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));
vi.mock('../../../context/TeamChannelsContext', () => ({ useTeamChannels: () => h.channels.current }));
vi.mock('../../chat-dock/ChatDockContext', () => ({ useChatDock: () => ({ openThread: h.openThread }) }));
vi.mock('@/shared/hooks/useResilientSubscription', () => ({
  useResilientSubscription: () => undefined,
}));
vi.mock('../../../services/internalChatService', () => ({
  markChannelRead: h.markChannelRead,
  sendChatMessage: h.sendChatMessage,
  subscribeToChannelMessages: vi.fn(),
}));

import { MAX_RAIL_THREADS, RailMessages, selectRailThreads } from '../RailMessages';
import type { ChatChannel } from '../../../types/internalChat';

const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ME = { uid: 'me', name: 'Me', photoUrl: null };

const channel = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'channel',
    name: `chan ${id}`,
    members: [],
    memberIds: ['me', 'x'],
    lastMessageText: `said in ${id}`,
    lastMessageAt: ts(1000),
    lastMessageSenderId: 'x',
    lastReadBy: { me: ts(2000) },
    ...over,
  }) as unknown as ChatChannel;

const unread = (id: string) => channel(id, { lastReadBy: {} });

beforeEach(() => {
  vi.clearAllMocks();
  h.channels.current = { channels: [], channelsReady: true, failed: false, me: ME };
});

describe('selectRailThreads', () => {
  it('puts unread first and caps the list', () => {
    const list = [...Array.from({ length: MAX_RAIL_THREADS + 2 }, (_, i) => channel(`r${i}`)), unread('u')];
    const out = selectRailThreads(list, 'me', '');
    expect(out[0].id).toBe('u');
    expect(out).toHaveLength(MAX_RAIL_THREADS);
  });

  it('search reaches past the cap, by name or text', () => {
    const list = Array.from({ length: MAX_RAIL_THREADS + 2 }, (_, i) => channel(`r${i}`));
    expect(selectRailThreads(list, 'me', `chan r${MAX_RAIL_THREADS + 1}`).map((c) => c.id)).toEqual([`r${MAX_RAIL_THREADS + 1}`]);
    expect(selectRailThreads(list, 'me', 'said in r0').map((c) => c.id)).toEqual(['r0']);
  });
});

describe('RailMessages', () => {
  it('says a failed load apart from an empty one', () => {
    h.channels.current = { channels: [], channelsReady: true, failed: true, me: ME };
    const { rerender } = render(<RailMessages />);
    expect(screen.getByRole('alert')).toHaveTextContent("didn't load");
    h.channels.current = { channels: [], channelsReady: true, failed: false, me: ME };
    rerender(<RailMessages />);
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
  });

  it('showing the list marks nothing read; opening a thread does', async () => {
    h.channels.current = { channels: [unread('u')], channelsReady: true, failed: false, me: ME };
    render(<RailMessages />);
    expect(h.markChannelRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /chan u/ }));
    await waitFor(() => expect(h.markChannelRead).toHaveBeenCalledWith('u', 'me'));
  });

  it('Esc in a thread goes back to the list and is handled', () => {
    h.channels.current = { channels: [channel('a')], channelsReady: true, failed: false, me: ME };
    render(<RailMessages />);
    fireEvent.click(screen.getByRole('button', { name: /chan a/ }));
    const notHandled = fireEvent.keyDown(window, { key: 'Escape' });
    expect(notHandled).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Search conversations' })).toBeInTheDocument();
  });

  it('sends on Enter and clears the box', async () => {
    h.channels.current = { channels: [channel('a')], channelsReady: true, failed: false, me: ME };
    render(<RailMessages />);
    fireEvent.click(screen.getByRole('button', { name: /chan a/ }));
    const box = screen.getByRole('textbox', { name: 'Reply to chan a' });
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(h.sendChatMessage).toHaveBeenCalledWith('a', ME, 'hello'));
    expect(box).toHaveValue('');
  });

  it('a failed send keeps the text and says so', async () => {
    h.sendChatMessage.mockRejectedValueOnce(new Error('offline'));
    h.channels.current = { channels: [channel('a')], channelsReady: true, failed: false, me: ME };
    render(<RailMessages />);
    fireEvent.click(screen.getByRole('button', { name: /chan a/ }));
    const box = screen.getByRole('textbox', { name: 'Reply to chan a' });
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Message not sent');
    expect(box).toHaveValue('hello');
  });

  it('pop-out docks the thread and tells the rail', () => {
    h.channels.current = { channels: [channel('a')], channelsReady: true, failed: false, me: ME };
    const onNavigate = vi.fn();
    render(<RailMessages onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /chan a/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pop out as a docked window' }));
    expect(h.openThread).toHaveBeenCalledWith('a');
    expect(onNavigate).toHaveBeenCalled();
  });
});
