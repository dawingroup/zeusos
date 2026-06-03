/**
 * UnifiedInboxPage — /comms/inbox.
 *
 * One queue across every channel. Today it merges all Team Chat conversations
 * (named channels + DMs) into a single recency-sorted inbox with a reading
 * pane + composer; WhatsApp threads fold in once the Meta provider is enabled
 * (commsConfig/whatsapp.enabled) and the live WA subscription ports.
 *
 * Reuses the internalChatService + presence; member-gated by firestore.rules.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Send, Hash, MessageSquare, Inbox } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Banner } from '@/shared/components/data-display';
import { useAuth } from '@/core/hooks/useAuth';
import { useCurrentDawinUser } from '@/core/settings';
import {
  subscribeToChannels,
  subscribeToChannelMessages,
  sendChatMessage,
  markChannelRead,
} from '../services/internalChatService';
import { subscribeToPresence, startPresenceHeartbeat } from '../services/presenceService';
import { useWhatsAppConfig } from '../services/comms-config.service';
import {
  channelLabel,
  isChannelUnread,
  presenceStateFrom,
  presenceColor,
  computeReadState,
  type ChatChannel,
  type ChatMember,
  type ChatMessage,
  type PresenceDoc,
} from '../types/internalChat';

function timeAgo(ts: { toMillis?: () => number } | null): string {
  const ms = ts?.toMillis?.();
  if (!ms) return '';
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function fmtClock(ts: { toDate?: () => Date } | null): string {
  const d = ts?.toDate?.();
  if (!d) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function UnifiedInboxPage() {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const { config: waConfig } = useWhatsAppConfig();

  const me: ChatMember | null = useMemo(() => {
    if (!user?.uid) return null;
    return {
      uid: user.uid,
      name: dawinUser?.displayName || user.displayName || user.email || 'Me',
      photoUrl: user.photoURL || null,
    };
  }, [user, dawinUser]);

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceDoc>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) return;
    const stopBeat = startPresenceHeartbeat(me.uid, me.name);
    const unsubP = subscribeToPresence(setPresence);
    return () => { stopBeat(); unsubP(); };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const unsub = subscribeToChannels(me.uid, setChannels, (e) => setError(e.message));
    return () => unsub();
  }, [me]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const unsub = subscribeToChannelMessages(activeId, setMessages, (e) => setError(e.message));
    if (me) markChannelRead(activeId, me.uid).catch(() => {});
    return () => unsub();
  }, [activeId, me]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Recency-sorted conversation list. (WhatsApp threads merge in here once the
  // live WA subscription ports — they share the same row shape.)
  const conversations = useMemo(() => {
    const list = [...channels];
    list.sort((a, b) => (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0));
    if (filter === 'unread' && me) return list.filter((c) => isChannelUnread(c, me.uid));
    return list;
  }, [channels, filter, me]);

  const active = channels.find((c) => c.id === activeId) || null;
  const unreadTotal = useMemo(
    () => (me ? channels.filter((c) => isChannelUnread(c, me.uid)).length : 0),
    [channels, me],
  );

  const onSend = async () => {
    if (!me || !activeId || !draft.trim()) return;
    const text = draft;
    setDraft('');
    try {
      await sendChatMessage(activeId, me, text);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to send');
      setDraft(text);
    }
  };

  // DM peer presence for the row dot.
  function rowDot(c: ChatChannel) {
    if (c.type !== 'dm' || !me) return null;
    const peer = c.memberIds.find((u) => u !== me.uid);
    if (!peer) return null;
    return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: presenceColor(presenceStateFrom(presence[peer])) }} aria-hidden />;
  }

  return (
    <>
      <Helmet><title>Unified Inbox | ZeusOS</title></Helmet>
      <div className="px-4 py-4 sm:px-6 sm:py-4 max-w-[1640px] mx-auto">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="display flex items-center gap-2">
              <Inbox className="h-5 w-5" style={{ color: 'var(--brand-accent)' }} /> Unified Inbox
            </h1>
            <p className="text-[12.5px]" style={{ color: 'var(--fg-tertiary)', marginTop: 2 }}>
              Team Chat{waConfig.enabled ? ' + WhatsApp' : ''} in one queue
              {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''}.
            </p>
          </div>
          <div className="flex gap-1">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-3 h-8 rounded-md text-[12.5px]"
                style={{
                  background: filter === f ? 'var(--fg-primary)' : 'transparent',
                  color: filter === f ? 'var(--bg-surface)' : 'var(--fg-secondary)',
                  border: filter === f ? 'none' : '1px solid var(--border-default)',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && <Banner tone="danger" title="Inbox error" message={error} />}
        {!waConfig.enabled && (
          <p className="text-[11.5px] mb-2" style={{ color: 'var(--fg-tertiary)' }}>
            WhatsApp threads appear here once a Meta provider is enabled in Comms → Settings.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-13rem)]">
          {/* Conversation list */}
          <div className="rounded-[10px] border overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }} data-testid="inbox-thread-list">
            {conversations.length === 0 && (
              <div className="p-6 text-center text-[13px]" style={{ color: 'var(--fg-tertiary)' }}>
                {filter === 'unread' ? 'Nothing unread.' : 'No conversations yet.'}
              </div>
            )}
            {conversations.map((c) => {
              const unread = me ? isChannelUnread(c, me.uid) : false;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b hover:bg-[var(--bg-sunken)]"
                  style={{ borderColor: 'var(--border-subtle)', background: c.id === activeId ? 'var(--bg-sunken)' : undefined }}
                >
                  <span className="mt-0.5 flex-none">
                    {c.type === 'channel' ? <Hash className="h-4 w-4" style={{ color: 'var(--fg-tertiary)' }} /> : (rowDot(c) ?? <MessageSquare className="h-4 w-4" style={{ color: 'var(--fg-tertiary)' }} />)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] truncate" style={{ fontWeight: unread ? 700 : 500 }}>
                        {channelLabel(c, me?.uid || '')}
                      </span>
                      <span className="text-[10.5px] tabular-nums flex-none" style={{ color: 'var(--fg-quaternary)' }}>
                        {timeAgo(c.lastMessageAt)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11.5px] truncate" style={{ color: 'var(--fg-tertiary)' }}>
                        {c.lastMessageSenderName ? `${c.lastMessageSenderName}: ` : ''}{c.lastMessageText || 'No messages yet'}
                      </span>
                      {unread && <span className="h-2 w-2 rounded-full flex-none" style={{ background: 'var(--zeus-red)' }} />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Reading pane */}
          <div className="rounded-[10px] border flex flex-col overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: 'var(--fg-tertiary)' }}>
                Select a conversation.
              </div>
            ) : (
              <>
                <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  {active.type === 'channel' ? <Hash className="h-4 w-4" style={{ color: 'var(--fg-tertiary)' }} /> : rowDot(active)}
                  <span className="text-[13.5px] font-semibold">{channelLabel(active, me?.uid || '')}</span>
                  <span className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                    {active.type === 'channel' ? `${active.memberIds.length} member${active.memberIds.length === 1 ? '' : 's'}` : 'Direct message'}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const mine = m.senderId === me?.uid;
                    const read = mine && me ? computeReadState(active, m, me.uid) : null;
                    return (
                      <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        {!mine && <span className="text-[11px] mb-0.5" style={{ color: 'var(--fg-tertiary)' }}>{m.senderName}</span>}
                        <div className="max-w-[75%] rounded-[10px] px-3 py-2 text-[13px]"
                          style={{ backgroundColor: mine ? 'var(--brand-accent)' : 'var(--bg-surface)', color: mine ? 'var(--brand-accent-fg)' : 'var(--fg-primary)', border: mine ? 'none' : '1px solid var(--border-subtle)' }}>
                          {m.text}
                        </div>
                        <span className="text-[10px] mt-0.5" style={{ color: 'var(--fg-quaternary)' }}>
                          {fmtClock(m.createdAt)}
                          {read && read.totalOthers > 0 && read.readByUids.length >= read.totalOthers ? ' · Read' : ''}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Message…"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                  />
                  <Button size="icon" className="h-9 w-9" onClick={onSend} disabled={!draft.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
