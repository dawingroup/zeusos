/**
 * One conversation's live tail, plus its read cursor — shared by the rail's open
 * thread and each docked window, so a thread behaves the same in both.
 */
import * as React from 'react';

import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import { markChannelRead, subscribeToChannelMessages } from '../services/internalChatService';
import { isChannelUnread, type ChatChannel, type ChatMessage } from '../types/internalChat';

/** A rail or a window is a glance, not a reading session — the page keeps the long tail. */
export const COMPACT_MESSAGE_LIMIT = 50;

export function useChannelThread(channelId: string) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const shownChannelRef = React.useRef<string | null>(null);

  useResilientSubscription(
    (health) => {
      // A retry keeps the messages on screen; only switching channel clears them.
      if (shownChannelRef.current !== channelId) {
        shownChannelRef.current = channelId;
        setMessages([]);
        setLoading(true);
      }
      return subscribeToChannelMessages(
        channelId,
        (msgs) => {
          setMessages(msgs);
          setLoading(false);
          setFailed(false);
          health.ok();
        },
        () => {
          // Clear loading on failure too: a denied read must not spin for ever.
          setLoading(false);
          setFailed(true);
          health.fail();
        },
        COMPACT_MESSAGE_LIMIT,
      );
    },
    [channelId],
  );

  return { messages, loading, failed };
}

/**
 * Advance the viewer's read cursor while the thread is actually being read.
 * `active` is false for a collapsed window: docking a thread must not clear its
 * unread badge without anyone looking at it.
 */
export function useChannelReadCursor(channel: ChatChannel, uid: string, active: boolean): void {
  const unread = isChannelUnread(channel, uid);
  React.useEffect(() => {
    if (!active || !unread) return;
    markChannelRead(channel.id, uid).catch(() => {
      /* the cursor is best-effort; the next message retries it */
    });
  }, [active, unread, channel.id, uid]);
}
