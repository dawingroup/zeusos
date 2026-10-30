/**
 * The floating team-chat dock: a row of small conversation windows along the
 * bottom edge, so a reply never costs you the page you were working on.
 *
 * Mounted once in AppShell. While the context rail is open it holds 340px on the
 * right, so windows lay out leftward from a reserved lane (see dockState.ts).
 * The dock has no launcher of its own: the rail's Messages segment pops threads
 * out into it.
 */
import * as React from 'react';

import { useTeamChannels } from '../../context/TeamChannelsContext';
import type { ChatChannel } from '../../types/internalChat';
import { useChatDock } from './ChatDockContext';
import { ChatWindow } from './ChatWindow';
import { layoutWindows, windowRightOffset } from './dockState';
import './chat-dock.css';
import '../rail-messages/rail-messages.css';

export interface ChatDockProps {
  /** Open the rail's Messages segment — where the conversation list lives. */
  onBrowseAll: () => void;
  /** Width of the lane the context rail holds on the right (0 when it holds none). */
  reservedRight?: number;
}

function useViewportWidth(): number {
  const [width, setWidth] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

export function ChatDock({ onBrowseAll, reservedRight = 0 }: ChatDockProps) {
  const { channels, channelsReady, failed, me } = useTeamChannels();
  const { state, closeThread, toggleCollapse } = useChatDock();
  const viewportWidth = useViewportWidth();

  const byId = React.useMemo(() => new Map<string, ChatChannel>(channels.map((c) => [c.id, c])), [channels]);
  const { visible, overflow, isMobile } = layoutWindows(state, viewportWidth, reservedRight);

  // A window whose channel is no longer readable is dropped rather than rendered
  // as a blank frame...
  const resolved = visible
    .map((w) => ({ w, channel: byId.get(w.channelId) }))
    .filter((r): r is { w: typeof r.w; channel: ChatChannel } => !!r.channel);

  // ...and pruned from state, so a stale id does not sit in localStorage eating a
  // slot. Only on a good load: pruning mid-load or on a failed read would drop
  // perfectly good windows.
  React.useEffect(() => {
    if (!channelsReady || failed || channels.length === 0) return;
    for (const w of state.windows) {
      if (!byId.has(w.channelId)) closeThread(w.channelId);
    }
  }, [channelsReady, failed, channels.length, state.windows, byId, closeThread]);

  if (!me) return null;

  return (
    <>
      {resolved.map(({ w, channel }, i) => (
        <ChatWindow
          key={w.channelId}
          channel={channel}
          me={me}
          collapsed={w.collapsed}
          right={windowRightOffset(i, reservedRight)}
          sheet={isMobile}
          overflowCount={isMobile ? overflow.length : 0}
          onShowOverflow={onBrowseAll}
          onToggleCollapse={() => toggleCollapse(w.channelId)}
          onClose={() => closeThread(w.channelId)}
        />
      ))}
      {/* On a narrow screen the sheet spans the width, so the count lives in its header. */}
      {overflow.length > 0 && !isMobile && (
        <button
          type="button"
          className="cd-overflow"
          style={{ right: windowRightOffset(resolved.length, reservedRight) }}
          title={`${overflow.length} more conversation${overflow.length === 1 ? '' : 's'}`}
          onClick={onBrowseAll}
        >
          +{overflow.length}
        </button>
      )}
    </>
  );
}

export default ChatDock;
