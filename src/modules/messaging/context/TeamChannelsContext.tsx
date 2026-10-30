/**
 * TeamChannelsProvider — the app-level owner of the viewer's chat channels.
 *
 * The rail's trigger and Messages segment and the floating chat dock all need
 * the channel list on every page, so the shell mounts ONE listener here. It also
 * gives the shell a real unread count: the old header badge was wired to no-op
 * placeholders and always read zero.
 *
 * Returns safe empty defaults outside the provider, so a surface rendered in
 * isolation degrades rather than crashes.
 */
import * as React from 'react';

import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import { subscribeToChannels } from '../services/internalChatService';
import { isChannelUnread, type ChatChannel, type ChatMember } from '../types/internalChat';

export interface TeamChannelsData {
  /** Non-archived channels + DMs the viewer belongs to, newest activity first. */
  channels: ChatChannel[];
  channelsReady: boolean;
  /** The feed failed to load — distinct from "no conversations yet". */
  failed: boolean;
  /** Number of those with unread activity for the viewer. */
  teamUnread: number;
  /** The viewer as a chat sender; null until signed in. */
  me: ChatMember | null;
}

const DEFAULT: TeamChannelsData = { channels: [], channelsReady: true, failed: false, teamUnread: 0, me: null };

const TeamChannelsContext = React.createContext<TeamChannelsData>(DEFAULT);

export function useTeamChannels(): TeamChannelsData {
  return React.useContext(TeamChannelsContext);
}

export function countUnread(channels: ChatChannel[], uid: string | null | undefined): number {
  if (!uid) return 0;
  return channels.filter((c) => isChannelUnread(c, uid)).length;
}

export function TeamChannelsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const uid = user?.uid ?? null;

  const me = React.useMemo<ChatMember | null>(() => {
    if (!uid) return null;
    return { uid, name: dawinUser?.displayName || user?.displayName || user?.email || 'Me', photoUrl: user?.photoURL || null };
  }, [uid, dawinUser?.displayName, user?.displayName, user?.email, user?.photoURL]);

  const [channels, setChannels] = React.useState<ChatChannel[]>([]);
  const [channelsReady, setChannelsReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Mounted by the shell, so this listener outlives every laptop sleep: one that
  // errors on wake is closed for good, and re-attaches here on a capped backoff.
  useResilientSubscription(
    (health) => {
      if (!uid) {
        setChannels([]);
        setChannelsReady(true);
        return undefined;
      }
      return subscribeToChannels(
        uid,
        (next) => {
          setChannels(next);
          setChannelsReady(true);
          setFailed(false);
          health.ok();
        },
        () => {
          setChannelsReady(true);
          setFailed(true);
          health.fail();
        },
      );
    },
    [uid],
  );

  const teamUnread = React.useMemo(() => countUnread(channels, uid), [channels, uid]);
  const value = React.useMemo<TeamChannelsData>(
    () => ({ channels, channelsReady, failed, teamUnread, me }),
    [channels, channelsReady, failed, teamUnread, me],
  );

  return <TeamChannelsContext.Provider value={value}>{children}</TeamChannelsContext.Provider>;
}
