/**
 * One docked conversation window. Owns exactly one Firestore message listener,
 * for its own channel, and renders the same thread view as the rail.
 */
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Maximize2, X } from 'lucide-react';

import { useChannelReadCursor, useChannelThread } from '../../hooks/useChannelThread';
import { avatarColor, initials } from '../../lib/avatar';
import { sendChatMessage } from '../../services/internalChatService';
import { channelLabel, isChannelUnread, type ChatChannel, type ChatMember } from '../../types/internalChat';
import { ThreadComposer, ThreadMessages } from '../thread/ThreadView';

export interface ChatWindowProps {
  channel: ChatChannel;
  me: ChatMember;
  collapsed: boolean;
  /** Right offset in px; the dock positions windows leftward from the corner. */
  right: number;
  /** Render as a full-width sheet (narrow viewports). */
  sheet?: boolean;
  /** Other docked threads not shown. In sheet mode this is a "+N" in the header. */
  overflowCount?: number;
  onShowOverflow?: () => void;
  onToggleCollapse: () => void;
  onClose: () => void;
}

export function ChatWindow({ channel, me, collapsed, right, sheet = false, overflowCount = 0, onShowOverflow, onToggleCollapse, onClose }: ChatWindowProps) {
  const navigate = useNavigate();
  const { messages, loading, failed } = useChannelThread(channel.id);

  // A collapsed window is visible but not being READ, so it must not advance the
  // read cursor.
  useChannelReadCursor(channel, me.uid, !collapsed);

  const label = channelLabel(channel, me.uid);
  const unread = isChannelUnread(channel, me.uid);

  return (
    <div
      className={`cd-window ${collapsed ? 'is-collapsed' : ''} ${sheet ? 'is-sheet' : ''}`}
      style={sheet ? undefined : { right }}
      role="dialog"
      aria-label={`Chat with ${label}`}
    >
      <div className="cd-window-head">
        <button type="button" className="cd-window-title" onClick={onToggleCollapse} aria-expanded={!collapsed} title={collapsed ? 'Expand' : 'Collapse'}>
          <span className="cd-avatar" style={{ background: avatarColor(label) }}>
            {initials(label)}
          </span>
          <span className="lbl">{label}</span>
          {collapsed && unread && <span className="cd-unread-dot" aria-label="Unread messages" />}
        </button>
        <div className="cd-window-actions">
          {sheet && overflowCount > 0 && (
            <button type="button" className="cd-more" title={`${overflowCount} more conversation${overflowCount === 1 ? '' : 's'}`} onClick={onShowOverflow}>
              +{overflowCount}
            </button>
          )}
          <button
            type="button"
            className="cd-iconbtn"
            title="Open in Comms"
            aria-label="Open in Comms"
            onClick={() => {
              navigate('/comms');
              onClose();
            }}
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button type="button" className="cd-iconbtn" title={collapsed ? 'Expand' : 'Collapse'} aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={onToggleCollapse}>
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button type="button" className="cd-iconbtn" title="Close" aria-label="Close" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <ThreadMessages channel={channel} messages={messages} loading={loading} failed={failed} myUid={me.uid} className="cd-window-body" />
          <ThreadComposer label={label} onSend={(text) => sendChatMessage(channel.id, me, text)} />
        </>
      )}
    </div>
  );
}

export default ChatWindow;
