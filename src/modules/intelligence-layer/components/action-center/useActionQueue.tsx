/**
 * The action queue — one owner for "what needs this person now".
 *
 * The top-bar trigger, the rail's Actions segment and the shell's first-run
 * default all read the same queue. It reads the shell's one task feed (MyTasksContext)
 * and holds the per-device dismissals, so two readers do not each hold their own
 * copy. Outside the provider it returns an empty queue, so a surface
 * rendered in isolation degrades rather than crashes.
 */
import * as React from 'react';

import { useMyTasks } from '@/modules/intelligence-layer/context/MyTasksContext';
import { buildActionItems, type ActionItem } from './config';

const LS_DISMISSED = 'zeus_ac_dismissed_v1';
const LEAVE_MS = 320;

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>): void {
  try {
    localStorage.setItem(LS_DISMISSED, JSON.stringify([...set]));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export interface ActionQueue {
  loading: boolean;
  visible: ActionItem[];
  blockingCount: number;
  dismissedCount: number;
  /** The item animating out, so the row can fade before it is dropped. */
  leavingId: string | null;
  now: number;
  /** Hide an item without completing it; the task itself stays open. */
  dismiss: (id: string) => void;
  /** Close the task through the engine. The item stays if the call fails. */
  resolve: (id: string) => Promise<void>;
  clearAll: () => void;
  restoreAll: () => void;
}

const EMPTY: ActionQueue = {
  loading: false,
  visible: [],
  blockingCount: 0,
  dismissedCount: 0,
  leavingId: null,
  now: 0,
  dismiss: () => undefined,
  resolve: async () => undefined,
  clearAll: () => undefined,
  restoreAll: () => undefined,
};

const ActionQueueContext = React.createContext<ActionQueue>(EMPTY);

export function useActionQueue(): ActionQueue {
  return React.useContext(ActionQueueContext);
}

export function ActionQueueProvider({ children }: { children: React.ReactNode }) {
  const { openTasks: tasks, loading, completeTask } = useMyTasks();
  const [dismissed, setDismissed] = React.useState<Set<string>>(loadDismissed);
  const [leavingId, setLeavingId] = React.useState<string | null>(null);

  React.useEffect(() => saveDismissed(dismissed), [dismissed]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- "now" moves when the tasks do.
  const now = React.useMemo(() => Date.now(), [tasks]);
  const visible = React.useMemo(() => buildActionItems(tasks, dismissed, now), [tasks, dismissed, now]);

  const leave = React.useCallback((id: string) => {
    setLeavingId(id);
    window.setTimeout(() => {
      setDismissed((prev) => new Set(prev).add(id));
      setLeavingId(null);
    }, LEAVE_MS);
  }, []);

  const resolve = React.useCallback(
    async (id: string) => {
      setLeavingId(id);
      try {
        await completeTask(id);
      } catch (err) {
        setLeavingId(null);
        throw err;
      }
      leave(id);
    },
    [completeTask, leave],
  );

  const clearAll = React.useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      visible.forEach((v) => next.add(v.task.id));
      return next;
    });
  }, [visible]);

  const restoreAll = React.useCallback(() => setDismissed(new Set()), []);

  const value = React.useMemo<ActionQueue>(
    () => ({
      loading,
      visible,
      blockingCount: visible.filter((v) => v.urgency === 'blocking').length,
      dismissedCount: dismissed.size,
      leavingId,
      now,
      dismiss: leave,
      resolve,
      clearAll,
      restoreAll,
    }),
    [loading, visible, dismissed.size, leavingId, now, leave, resolve, clearAll, restoreAll],
  );

  return <ActionQueueContext.Provider value={value}>{children}</ActionQueueContext.Provider>;
}
