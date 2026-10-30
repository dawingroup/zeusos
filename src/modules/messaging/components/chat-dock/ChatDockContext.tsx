/**
 * Chat-dock control surface.
 *
 * Exposed as context so anything in the app can open a conversation WITHOUT
 * navigating — which is the whole point of the dock. The rail's Messages segment
 * pops a thread out into it, without throwing the person onto /comms and
 * losing their page.
 *
 * Safe to call outside the provider (the actions are no-ops), so a surface
 * rendered in isolation or in a test does not need the whole shell.
 */

import * as React from 'react';
import {
  dockReducer,
  loadDockState,
  saveDockState,
  EMPTY_DOCK,
  type DockState,
} from './dockState';

export interface ChatDockApi {
  state: DockState;
  /** Open (or surface) a thread as a docked window. */
  openThread: (channelId: string) => void;
  closeThread: (channelId: string) => void;
  toggleCollapse: (channelId: string) => void;
  /** Fold every window to its title bar — used when a competing panel opens. */
  collapseAll: () => void;
  closeAll: () => void;
  /** True when at least one thread is docked. */
  hasWindows: boolean;
}

const NOOP: ChatDockApi = {
  state: EMPTY_DOCK,
  openThread: () => {},
  closeThread: () => {},
  toggleCollapse: () => {},
  collapseAll: () => {},
  closeAll: () => {},
  hasWindows: false,
};

const ChatDockContext = React.createContext<ChatDockApi>(NOOP);

export function useChatDock(): ChatDockApi {
  return React.useContext(ChatDockContext);
}

export function ChatDockProvider({ children }: { children: React.ReactNode }) {
  // Rehydrate lazily so a reload restores the threads you had docked.
  const [state, dispatch] = React.useReducer(dockReducer, undefined, loadDockState);

  React.useEffect(() => {
    saveDockState(state);
  }, [state]);

  const api = React.useMemo<ChatDockApi>(
    () => ({
      state,
      openThread: (channelId: string) => dispatch({ type: 'open', channelId }),
      closeThread: (channelId: string) => dispatch({ type: 'close', channelId }),
      toggleCollapse: (channelId: string) => dispatch({ type: 'toggleCollapse', channelId }),
      collapseAll: () => dispatch({ type: 'collapseAll' }),
      closeAll: () => dispatch({ type: 'closeAll' }),
      hasWindows: state.windows.length > 0,
    }),
    [state],
  );

  return <ChatDockContext.Provider value={api}>{children}</ChatDockContext.Provider>;
}
