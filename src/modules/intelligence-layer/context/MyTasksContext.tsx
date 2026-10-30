/**
 * MyTasksProvider — the app-level owner of the signed-in person's task feed.
 *
 * The rail's Tasks and Actions segments and the trigger need the person's open
 * tasks and today's plan on every page. The shell mounts this once, so there is
 * ONE open-tasks listener and ONE `useTodayPlan()`, whichever surfaces are showing.
 *
 * Returns safe empty defaults outside the provider, so a surface rendered in
 * isolation degrades rather than crashes.
 */
import * as React from 'react';

import { useAuth } from '@/shared/hooks';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import { useTodayPlan } from '../daily-plan/hooks/useTodayPlan';
import { blockTask as blockTaskFn, completeTask as completeTaskFn, startTask as startTaskFn } from '../daily-plan/services/tasksService';
import { getDueDateStatus, type EmployeeTask } from '../hooks/useEmployeeTaskInbox';
import { isPlannableTask, subscribeToMyOpenTasks } from '../services/myTasksFeed';
import { readPickedTaskId, selectCurrentTask, writePickedTaskId } from '../utils/currentTask';

export type TodayPlanState = ReturnType<typeof useTodayPlan>;

export interface MyTasksCounts {
  open: number;
  overdue: number;
  dueToday: number;
  inProgress: number;
  blocked: number;
}

export interface MyTasksData {
  loading: boolean;
  /** The feed failed to load — distinct from "nothing on your plate". */
  failed: boolean;
  /** Open, plannable tasks, most urgent first. */
  tasks: EmployeeTask[];
  /** EVERY open task, unfiltered, most urgent first — for a surface with its own rule. */
  openTasks: EmployeeTask[];
  /** Today's focus plan; null outside the provider. */
  today: TodayPlanState | null;
  counts: MyTasksCounts;
  /** The task the person is on right now (see utils/currentTask). */
  current: EmployeeTask | null;
  /** Make a task the current one (or clear the pick with null). */
  pickCurrent: (taskId: string | null) => void;
  /** Mark a task in progress and make it the current one. */
  startTask: (taskId: string) => Promise<void>;
  /** Close a task through `taskAction`. Offer it only where `canCompleteFromList` says. */
  completeTask: (taskId: string) => Promise<void>;
  /** Put a task on hold with the reason. */
  blockTask: (taskId: string, reason: string) => Promise<void>;
}

const EMPTY_COUNTS: MyTasksCounts = { open: 0, overdue: 0, dueToday: 0, inProgress: 0, blocked: 0 };

const DEFAULT: MyTasksData = {
  loading: false,
  failed: false,
  tasks: [],
  openTasks: [],
  today: null,
  counts: EMPTY_COUNTS,
  current: null,
  pickCurrent: () => undefined,
  startTask: async () => undefined,
  completeTask: async () => undefined,
  blockTask: async () => undefined,
};

const MyTasksContext = React.createContext<MyTasksData>(DEFAULT);

export function useMyTasks(): MyTasksData {
  return React.useContext(MyTasksContext);
}

export function countTasks(tasks: EmployeeTask[]): MyTasksCounts {
  const counts = { ...EMPTY_COUNTS, open: tasks.length };
  for (const t of tasks) {
    const due = getDueDateStatus(t.dueDate);
    if (due === 'overdue') counts.overdue++;
    else if (due === 'today') counts.dueToday++;
    if (t.status === 'in_progress') counts.inProgress++;
    if (t.status === 'blocked') counts.blocked++;
  }
  return counts;
}

export function MyTasksProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const today = useTodayPlan();

  const [allOpen, setAllOpen] = React.useState<EmployeeTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [pickedId, setPickedId] = React.useState<string | null>(readPickedTaskId);

  // Mounted by the shell, so it outlives every laptop sleep: a listener that
  // errors on wake is closed for good; this re-attaches it on a capped backoff.
  useResilientSubscription(
    (health) => {
      if (!uid) {
        setAllOpen([]);
        setLoading(false);
        return undefined;
      }
      setLoading(true);
      return subscribeToMyOpenTasks(
        uid,
        (next) => {
          setAllOpen(next);
          setFailed(false);
          setLoading(false);
          health.ok();
        },
        () => {
          setAllOpen([]);
          setFailed(true);
          setLoading(false);
          health.fail();
        },
      );
    },
    [uid],
  );

  const tasks = React.useMemo(() => allOpen.filter(isPlannableTask), [allOpen]);
  const counts = React.useMemo(() => countTasks(tasks), [tasks]);
  const current = React.useMemo(() => selectCurrentTask(tasks, pickedId), [tasks, pickedId]);

  const pickCurrent = React.useCallback((taskId: string | null) => {
    setPickedId(taskId);
    writePickedTaskId(taskId);
  }, []);

  const startTask = React.useCallback(
    async (taskId: string) => {
      // Pick only once the write lands — a failed Start must not leave a
      // still-pending task showing as "Now".
      await startTaskFn(taskId);
      pickCurrent(taskId);
    },
    [pickCurrent],
  );

  const completeTask = React.useCallback(async (taskId: string) => {
    await completeTaskFn(taskId);
  }, []);

  const blockTask = React.useCallback(async (taskId: string, reason: string) => {
    await blockTaskFn(taskId, reason);
  }, []);

  const value = React.useMemo<MyTasksData>(
    () => ({ loading, failed, tasks, openTasks: allOpen, today, counts, current, pickCurrent, startTask, completeTask, blockTask }),
    [loading, failed, tasks, allOpen, today, counts, current, pickCurrent, startTask, completeTask, blockTask],
  );

  return <MyTasksContext.Provider value={value}>{children}</MyTasksContext.Provider>;
}
