/**
 * The compact conversation body and composer, shared by the rail and the dock.
 * The full Team Chat page keeps its own richer view.
 */
import * as React from 'react';

import { avatarColor } from '../../lib/avatar';
import type { ChatChannel, ChatMessage } from '../../types/internalChat';

function clock(ts: ChatMessage['createdAt']): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

/** A bare attachment has no text; say what it is rather than show an empty bubble. */
function bodyOf(m: ChatMessage): string {
  return m.text || m.driveFile?.name || m.linkedRecord?.title || 'Attachment';
}

export interface ThreadMessagesProps {
  channel: ChatChannel;
  messages: ChatMessage[];
  loading: boolean;
  failed: boolean;
  myUid: string;
  className?: string;
}

export function ThreadMessages({ channel, messages, loading, failed, myUid, className = 'rail-thread' }: ThreadMessagesProps) {
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Follow the tail of the open conversation.
  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [channel.id, messages.length]);

  return (
    <div ref={bodyRef} className={className} aria-live="polite">
      {failed && messages.length === 0 ? (
        <p className="rail-msg-empty" role="alert">This conversation didn't load — reload to try again.</p>
      ) : loading ? (
        <p className="rail-msg-empty">Loading messages…</p>
      ) : messages.length === 0 ? (
        <p className="rail-msg-empty">No messages yet.</p>
      ) : (
        messages.map((m) => {
          const mine = m.senderId === myUid;
          return (
            <div key={m.id} className={`rail-bubble ${mine ? 'me' : 'them'}`}>
              {!mine && channel.type === 'channel' && m.senderName && (
                <div className="rail-bubble-name" style={{ color: avatarColor(m.senderName) }}>
                  {m.senderName}
                </div>
              )}
              <div className="rail-bubble-body">{bodyOf(m)}</div>
              <div className="rail-bubble-meta">{clock(m.createdAt)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

export interface ThreadComposerProps {
  label: string;
  /** Rejects when the message did not go. */
  onSend: (text: string) => Promise<void>;
  autoFocus?: boolean;
}

export function ThreadComposer({ label, onSend, autoFocus = false }: ThreadComposerProps) {
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const send = async () => {
    const text = draft;
    if (!text.trim() || sending) return;
    setSending(true);
    setDraft('');
    setError(null);
    try {
      await onSend(text);
    } catch {
      // Restore the text so nothing typed is lost to a failed send.
      setDraft((cur) => cur || text);
      setError('Message not sent — check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {error && (
        <div className="rail-notice is-error" role="alert">
          {error}
        </div>
      )}
      <div className="rail-composer">
        <textarea
          ref={inputRef}
          className="rail-composer-input"
          placeholder={`Message ${label}`}
          aria-label={`Reply to ${label}`}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="rail-composer-row">
          <span className="rail-composer-hint">Enter to send · Shift+Enter for a new line</span>
          <button type="button" className="rail-send" onClick={() => void send()} disabled={!draft.trim() || sending}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}
