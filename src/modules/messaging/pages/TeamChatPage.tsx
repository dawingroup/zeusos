/**
 * TeamChatPage — Phase 4.1.
 *
 * Internal staff chat: a two-pane surface (DMs + channels on the left, the
 * conversation on the right). Pure client-direct Firestore writes via
 * internalChatService; member-gated by firestore.rules → chatChannels.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Loader2, Plus, Send, Hash, MessagesSquare, Settings } from 'lucide-react';
import { Banner } from '@/shared/components/data-display';
import { useAuth } from '@/core/hooks/useAuth';
import { useCurrentDawinUser } from '@/core/settings';
import {
  subscribeToChannels,
  subscribeToChannelMessages,
  sendChatMessage,
  markChannelRead,
  getOrCreateDM,
  createChannel,
} from '../services/internalChatService';
import { subscribeToPresence } from '../services/presenceService';
import { startPresenceHeartbeat } from '../services/presenceService';
import { subscribeStaff } from '../services/staff-directory.service';
import { PushRegistrar } from '../components/PushRegistrar';
import {
  channelLabel,
  isChannelUnread,
  presenceStateFrom,
  presenceColor,
  type ChatChannel,
  type ChatMember,
  type ChatMessage,
  type PresenceDoc,
} from '../types/internalChat';

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />;
}

export default function TeamChatPage() {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();

  const me: ChatMember | null = useMemo(() => {
    if (!user?.uid) return null;
    return {
      uid: user.uid,
      name: dawinUser?.displayName || user.displayName || user.email || 'Me',
      photoUrl: user.photoURL || null,
    };
  }, [user, dawinUser]);

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [staff, setStaff] = useState<ChatMember[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceDoc>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Presence heartbeat + subscriptions.
  useEffect(() => {
    if (!me) return;
    const stopBeat = startPresenceHeartbeat(me.uid, me.name);
    const unsubP = subscribeToPresence(setPresence);
    const unsubS = subscribeStaff(setStaff);
    return () => { stopBeat(); unsubP(); unsubS(); };
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

  const active = channels.find((c) => c.id === activeId) || null;

  const onSend = async () => {
    if (!me || !activeId || !draft.trim()) return;
    const text = draft;
    setDraft('');
    try {
      await sendChatMessage(activeId, me, text);
    } catch (e: any) {
      setError(e?.message || 'Failed to send');
      setDraft(text);
    }
  };

  const openDM = async (peer: ChatMember) => {
    if (!me || peer.uid === me.uid) return;
    try {
      const id = await getOrCreateDM(me, peer);
      setActiveId(id);
    } catch (e: any) {
      setError(e?.message || 'Failed to open DM');
    }
  };

  const onCreateChannel = async () => {
    if (!me || !newChannelName.trim()) return;
    setCreating(true);
    try {
      const id = await createChannel({ name: newChannelName.trim(), members: [me], createdBy: me.uid });
      setNewChannelName('');
      setShowNew(false);
      setActiveId(id);
    } catch (e: any) {
      setError(e?.message || 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  const dmChannels = channels.filter((c) => c.type === 'dm');
  const namedChannels = channels.filter((c) => c.type === 'channel');
  const otherStaff = staff.filter((s) => s.uid !== me?.uid);

  return (
    <>
      <Helmet><title>Team Chat | ZeusOS</title></Helmet>
      <PushRegistrar />
      <div className="px-4 py-4 sm:px-6 sm:py-4 max-w-[1640px] mx-auto">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="display flex items-center gap-2"><MessagesSquare className="h-5 w-5" style={{ color: 'var(--accent)' }} /> Team chat</h1>
          <Link to="/comms/settings" className="text-[12px] inline-flex items-center gap-1" style={{ color: 'var(--fg-tertiary)' }}>
            <Settings className="h-3.5 w-3.5" /> Channel settings
          </Link>
        </div>
        {error && <Banner tone="danger" title="Chat error" message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 h-[calc(100vh-12rem)]">
          {/* Sidebar */}
          <div className="rounded-[10px] border overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-[12px] uppercase tracking-wide" style={{ color: 'var(--fg-tertiary)' }}>Channels</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNew((s) => !s)}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {showNew && (
              <div className="p-2 flex gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <Input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="channel name" onKeyDown={(e) => { if (e.key === 'Enter') onCreateChannel(); }} />
                <Button size="icon" className="h-9 w-9" onClick={onCreateChannel} disabled={creating || !newChannelName.trim()}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
            {namedChannels.map((c) => (
              <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-hover)]"
                style={{ backgroundColor: c.id === activeId ? 'var(--bg-hover)' : undefined }}>
                <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fg-tertiary)' }} />
                <span className="text-[13px] truncate flex-1" style={{ fontWeight: me && isChannelUnread(c, me.uid) ? 600 : 400 }}>{channelLabel(c, me?.uid || '')}</span>
              </button>
            ))}

            <div className="px-3 py-2 border-b border-t mt-1 text-[12px] uppercase tracking-wide" style={{ color: 'var(--fg-tertiary)', borderColor: 'var(--border-subtle)' }}>Direct messages</div>
            {dmChannels.map((c) => (
              <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-hover)]"
                style={{ backgroundColor: c.id === activeId ? 'var(--bg-hover)' : undefined }}>
                <span className="text-[13px] truncate flex-1" style={{ fontWeight: me && isChannelUnread(c, me.uid) ? 600 : 400 }}>{channelLabel(c, me?.uid || '')}</span>
              </button>
            ))}
            {/* Start a new DM with any teammate */}
            {otherStaff.map((s) => (
              <button key={s.uid} type="button" onClick={() => openDM(s)}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-hover)]">
                <Dot color={presenceColor(presenceStateFrom(presence[s.uid]))} />
                <span className="text-[12.5px] truncate" style={{ color: 'var(--fg-secondary)' }}>{s.name}</span>
              </button>
            ))}
          </div>

          {/* Thread */}
          <div className="rounded-[10px] border flex flex-col overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: 'var(--fg-tertiary)' }}>
                Select a conversation or start a DM.
              </div>
            ) : (
              <>
                <div className="px-4 py-2.5 border-b text-[13.5px] font-medium" style={{ borderColor: 'var(--border-subtle)' }}>
                  {channelLabel(active, me?.uid || '')}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const mine = m.senderId === me?.uid;
                    return (
                      <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        {!mine && <span className="text-[11px] mb-0.5" style={{ color: 'var(--fg-tertiary)' }}>{m.senderName}</span>}
                        <div className="max-w-[75%] rounded-[10px] px-3 py-2 text-[13px]"
                          style={{ backgroundColor: mine ? 'var(--accent)' : 'var(--bg-surface)', color: mine ? '#fff' : 'var(--fg-primary)', border: mine ? 'none' : '1px solid var(--border-subtle)' }}>
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} />
                  <Button size="icon" className="h-9 w-9" onClick={onSend} disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
