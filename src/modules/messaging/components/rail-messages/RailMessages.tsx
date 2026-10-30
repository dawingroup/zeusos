/**
 * Messages — the context rail's Messages segment: read and answer a conversation
 * without leaving the page.
 *
 * Two views inside the segment:
 *   list   — the latest conversations, unread first, with a search that reaches
 *            all of them
 *   thread — the messages and a composer. Its header can pop the thread out into
 *            a docked window (ChatDock) or open Comms.
 *
 * SELECTING A THREAD MARKS IT READ. Showing the list never does.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, Maximize2, MessageCircle, PanelBottom, Search } from 'lucide-react';

import { useTeamChannels } from '../../context/TeamChannelsContext';
import { useChannelReadCursor, useChannelThread } from '../../hooks/useChannelThread';
import { avatarColor, initials } from '../../lib/avatar';
import { sendChatMessage } from '../../services/internalChatService';
import { channelLabel, isChannelUnread, type ChatChannel, type ChatMember } from '../../types/internalChat';
import { useChatDock } from '../chat-dock/ChatDockContext';
import { ThreadComposer, ThreadMessages } from '../thread/ThreadView';
import './rail-messages.css';

/** Conversations shown before searching reaches the rest. */
export const MAX_RAIL_THREADS = 6;
/** Search results shown, however many match. */
export const MAX_RAIL_SEARCH_RESULTS = 30;

export interface RailMessagesProps {
  /** Called after a row navigates away (the rail closes itself in overlay mode). */
  onNavigate?: () => void;
}

function timeAgo(ts: ChatChannel['lastMessageAt']): string {
  const ms = ts?.toMillis?.();
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Unread first, then most recent — the two things that decide what to open next. */
export function selectRailThreads(channels: ChatChannel[], uid: string, q: string): ChatChannel[] {
  const needle = q.trim().toLowerCase();
  if (needle) {
    return channels
      .filter((c) => channelLabel(c, uid).toLowerCase().includes(needle) || (c.lastMessageText || '').toLowerCase().includes(needle))
      .slice(0, MAX_RAIL_SEARCH_RESULTS);
  }
  return [...channels]
    .sort((a, b) => Number(isChannelUnread(b, uid)) - Number(isChannelUnread(a, uid)))
    .slice(0, MAX_RAIL_THREADS);
}

export function RailMessages({ onNavigate }: RailMessagesProps) {
  const { channels, channelsReady, failed, me } = useTeamChannels();
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = selectedId ? channels.find((c) => c.id === selectedId) ?? null : null;
  const uid = me?.uid ?? '';
  const visible = React.useMemo(() => selectRailThreads(channels, uid, query), [channels, uid, query]);

  if (selected && me) {
    return <RailThread channel={selected} me={me} onBack={() => setSelectedId(null)} onNavigate={onNavigate} />;
  }

  return (
    <div className="rail-list-view">
      <div className="rail-search">
        <Search className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <input
          className="rail-search-input"
          placeholder="Search conversations"
          aria-label="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="rail-list">
        {failed && channels.length === 0 && <p className="rail-msg-empty" role="alert">Your conversations didn't load — reload to try again.</p>}
        {!channelsReady && channels.length === 0 && <p className="rail-msg-empty">Loading conversations…</p>}
        {channelsReady && !failed && channels.length === 0 && <p className="rail-msg-empty">No conversations yet.</p>}
        {channels.length > 0 && visible.length === 0 && <p className="rail-msg-empty">Nothing matches that.</p>}
        {visible.map((c) => {
          const label = channelLabel(c, uid);
          const unread = isChannelUnread(c, uid);
          return (
            <button key={c.id} type="button" className="rail-msg" onClick={() => setSelectedId(c.id)}>
              <span className="rail-msg-avatar" style={{ background: avatarColor(label) }}>
                {initials(label)}
              </span>
              <span className="rail-msg-body">
                <span className="rail-msg-top">
                  <span className="rail-msg-name" data-unread={unread || undefined}>
                    {label}
                  </span>
                  <span className="rail-msg-when">{timeAgo(c.lastMessageAt)}</span>
                </span>
                <span className="rail-msg-snip">{c.lastMessageText || 'No messages yet'}</span>
                <span className="rail-msg-tags">
                  <span className="rail-msg-pill">
                    {c.type === 'channel' ? (
                      <Hash className="h-[9px] w-[9px]" aria-hidden="true" />
                    ) : (
                      <MessageCircle className="h-[9px] w-[9px]" aria-hidden="true" />
                    )}
                    {c.type === 'channel' ? 'Channel' : 'Direct message'}
                  </span>
                  {unread && <span className="rail-msg-unread" aria-label="Unread" />}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RailThreadProps {
  channel: ChatChannel;
  me: ChatMember;
  onBack: () => void;
  onNavigate?: () => void;
}

function RailThread({ channel, me, onBack, onNavigate }: RailThreadProps) {
  const navigate = useNavigate();
  const { openThread: dockThread } = useChatDock();
  const { messages, loading, failed } = useChannelThread(channel.id);
  useChannelReadCursor(channel, me.uid, true);

  const label = channelLabel(channel, me.uid);

  // In a thread, Esc goes back to the list — it never closes the rail from under
  // a half-written reply. Capture phase + preventDefault, so it runs before the
  // rail's own Esc listener, which skips a handled event.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onBack]);

  return (
    <div className="rail-thread-view">
      <div className="rail-thread-head">
        <button type="button" className="rail-iconbtn" title="Back to all messages (Esc)" aria-label="Back to all messages" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="rail-thread-title">
          <div className="rail-thread-name">{label}</div>
          <div className="rail-thread-sub">
            {channel.type === 'channel' ? `${channel.memberIds.length} members` : 'Direct message'}
          </div>
        </div>
        <button
          type="button"
          className="rail-iconbtn"
          title="Pop out as a docked window"
          aria-label="Pop out as a docked window"
          onClick={() => {
            dockThread(channel.id);
            onBack();
            // An overlay rail would sit on top of the window it just opened.
            onNavigate?.();
          }}
        >
          <PanelBottom className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rail-iconbtn"
          title="Open in Comms"
          aria-label="Open in Comms"
          onClick={() => {
            navigate('/comms');
            onNavigate?.();
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <ThreadMessages channel={channel} messages={messages} loading={loading} failed={failed} myUid={me.uid} />
      <ThreadComposer label={label} autoFocus onSend={(text) => sendChatMessage(channel.id, me, text)} />
    </div>
  );
}

export default RailMessages;
