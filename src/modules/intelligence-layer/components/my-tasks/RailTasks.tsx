/**
 * My Tasks — the context rail's Tasks segment: a person's work, kept in view.
 *
 * A body with no chrome of its own (the rail supplies the header, sub line and
 * footer). Reads MyTasksContext, so it adds no listener.
 *
 *  - "Now working on" says what you are on and jumps straight back to it.
 *  - Today's focus plan comes first, then everything else that is open, most
 *    urgent first. Picking a row opens it where the work happens (`resolveTaskTarget`).
 *  - Start marks a task in progress and makes it the current one.
 *  - Done closes a task, but ONLY where `canCompleteFromList` says it may. Approvals,
 *    clearances and anything with open required checks have no box and open the task.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, Loader2, Play, UserCheck } from 'lucide-react';

import { PersonName } from '@/shared/people';
import { describeCallableError } from '@/shared/utils/callableError';
import { useMyTasks, type TodayPlanState } from '../../context/MyTasksContext';
import { formatDueDate, getDueDateStatus, type EmployeeTask } from '../../hooks/useEmployeeTaskInbox';
import { entityShortLabel, resolveTaskTarget } from '../../utils/actionTarget';
import { canCompleteFromList, canStartFromList } from '../../utils/listCompletion';
import './my-tasks.css';

/** Rows shown under "Everything else" before pointing at the full inbox. */
export const MAX_OTHER_ROWS = 20;

export interface RailTasksProps {
  /** Called after a row navigates away (the rail closes itself in overlay mode). */
  onNavigate?: () => void;
}

type PlanRow = NonNullable<TodayPlanState>['items'][number];

export function RailTasks({ onNavigate }: RailTasksProps) {
  const navigate = useNavigate();
  const { loading, failed, tasks, today, current, pickCurrent, startTask, completeTask } = useMyTasks();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  // Closed here and not yet dropped by the feed — shown done, never twice-clicked.
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const planItems: PlanRow[] = useMemo(() => today?.items ?? [], [today?.items]);
  const planIds = useMemo(() => new Set(planItems.map((i) => i.taskId)), [planItems]);
  const others = useMemo(() => tasks.filter((t) => !planIds.has(t.id)), [tasks, planIds]);

  const openTask = useCallback(
    (task: EmployeeTask) => {
      // Going back to something you are already on makes it the current task;
      // opening pending work just to look at it does not.
      if (task.status === 'in_progress') pickCurrent(task.id);
      navigate(resolveTaskTarget(task).go);
      onNavigate?.();
    },
    [navigate, onNavigate, pickCurrent],
  );

  const start = useCallback(
    async (task: EmployeeTask) => {
      setStartingId(task.id);
      setActionError(null);
      try {
        await startTask(task.id);
        openTask({ ...task, status: 'in_progress' });
      } catch (err) {
        setActionError(describeCallableError(err, `start "${task.title}"`));
      } finally {
        setStartingId(null);
      }
    },
    [startTask, openTask],
  );

  const complete = useCallback(
    async (task: EmployeeTask) => {
      if (!canCompleteFromList(task)) return;
      setCompletingId(task.id);
      setActionError(null);
      try {
        await completeTask(task.id);
        setDoneIds((prev) => new Set(prev).add(task.id));
      } catch (err) {
        setActionError(describeCallableError(err, `mark "${task.title}" done`));
      } finally {
        setCompletingId(null);
      }
    },
    [completeTask],
  );

  const openPlan = planItems.filter((i) => !(i.isClosed || i.outcome === 'done'));
  const nothing = !loading && !failed && tasks.length === 0 && openPlan.length === 0;
  const hiddenOthers = Math.max(0, others.length - MAX_OTHER_ROWS);

  return (
    <div className="mt-body">
      {current && (
        <section className="mt-now" aria-label="Now working on">
          <div className="mt-now-kicker">Now working on</div>
          <div className="mt-now-title">{current.title}</div>
          <div className="mt-now-row">
            {current.entityType && <span className="mt-chip">{entityShortLabel(current.entityType)}</span>}
            {canCompleteFromList(current) && !doneIds.has(current.id) && (
              <button
                type="button"
                className="mt-now-done"
                onClick={() => void complete(current)}
                disabled={completingId === current.id}
                aria-label={`Mark done: ${current.title}`}
              >
                {completingId === current.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Mark done
              </button>
            )}
            <button type="button" className="mt-now-go" onClick={() => openTask(current)}>
              Go to task <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {actionError && (
        <div className="mt-error" role="alert">
          {actionError}
        </div>
      )}

      {failed && (
        <div className="mt-error" role="alert">
          Your tasks didn't load — reload to try again.
        </div>
      )}

      {loading && tasks.length === 0 && <div className="mt-more">Checking…</div>}

      {nothing && (
        <div className="mt-empty">
          <span className="mt-empty-tile">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="mt-empty-title">Nothing on your plate</div>
        </div>
      )}

      {planItems.length > 0 && (
        <section aria-label="Today's plan">
          <div className="mt-section-head">
            <span>Today</span>
            <span className="mt-section-meta">
              {today?.doneCount ?? 0} of {today?.total ?? planItems.length} done
            </span>
          </div>
          <div className="mt-progress" aria-hidden="true">
            <span style={{ width: `${today?.pct ?? 0}%` }} />
          </div>
          <ul className="mt-list">
            {planItems.map((item) => {
              const task = byId.get(item.taskId);
              const done = item.isClosed || item.outcome === 'done';
              if (task && !done) {
                return (
                  <TaskRow
                    key={item.taskId}
                    task={task}
                    isCurrent={current?.id === task.id}
                    starting={startingId === task.id}
                    completing={completingId === task.id}
                    done={doneIds.has(task.id)}
                    onOpen={openTask}
                    onStart={start}
                    onComplete={complete}
                  />
                );
              }
              // Closed or handed on: shown muted, never hidden — the plan is what
              // was agreed, so what happened to it stays visible.
              return (
                <li key={item.taskId} className="mt-row is-muted" data-done={done || undefined}>
                  <span className="mt-row-state" aria-hidden="true">
                    {done ? <Check className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                  </span>
                  <span className="mt-row-main">
                    <span className="mt-row-title">{item.title}</span>
                    <span className="mt-row-meta">
                      {done ? (
                        'Done'
                      ) : item.currentAssignedToUserId ? (
                        <>
                          With <PersonName id={item.currentAssignedToUserId} />
                        </>
                      ) : (
                        'Not in your open tasks'
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section aria-label={planItems.length > 0 ? 'Everything else' : 'Open tasks'}>
          <div className="mt-section-head">
            <span>{planItems.length > 0 ? 'Everything else' : 'Open tasks'}</span>
            <span className="mt-section-meta">most urgent first</span>
          </div>
          <ul className="mt-list">
            {others.slice(0, MAX_OTHER_ROWS).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isCurrent={current?.id === task.id}
                starting={startingId === task.id}
                completing={completingId === task.id}
                done={doneIds.has(task.id)}
                onOpen={openTask}
                onStart={start}
                onComplete={complete}
              />
            ))}
          </ul>
          {hiddenOthers > 0 && <div className="mt-more">+{hiddenOthers} more in the inbox</div>}
        </section>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: EmployeeTask;
  isCurrent: boolean;
  starting: boolean;
  completing: boolean;
  /** Closed from here; the feed has not dropped it yet. */
  done: boolean;
  onOpen: (task: EmployeeTask) => void;
  onStart: (task: EmployeeTask) => void;
  onComplete: (task: EmployeeTask) => void;
}

function TaskRow({ task, isCurrent, starting, completing, done, onOpen, onStart, onComplete }: TaskRowProps) {
  const due = getDueDateStatus(task.dueDate);
  const dueLabel =
    due === 'none' ? null : due === 'overdue' ? `Overdue · ${formatDueDate(task.dueDate)}` : due === 'today' ? 'Due today' : `Due ${formatDueDate(task.dueDate)}`;
  const tone = task.priority === 'P0' || task.priority === 'P1' ? 'high' : task.priority === 'P3' ? 'low' : 'mid';

  return (
    <li className="mt-row" data-current={isCurrent || undefined} data-done={done || undefined}>
      {(done || canCompleteFromList(task)) && (
        <button
          type="button"
          className="mt-done"
          onClick={() => onComplete(task)}
          disabled={done || completing}
          aria-label={done ? `Done: ${task.title}` : `Mark done: ${task.title}`}
          title={done ? 'Done' : 'Mark done — closes the task'}
        >
          {completing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
        </button>
      )}
      <button type="button" className="mt-row-open" onClick={() => onOpen(task)} title={`Open: ${task.title}`}>
        <span className="mt-dot" data-tone={tone} aria-hidden="true" />
        <span className="mt-row-main">
          <span className="mt-row-title">{task.title}</span>
          <span className="mt-row-meta">
            {task.status === 'in_progress' && <span className="mt-tag is-progress">In progress</span>}
            {task.status === 'blocked' && <span className="mt-tag is-blocked">Blocked</span>}
            {dueLabel && (
              <span className="mt-due" data-due={due}>
                {dueLabel}
              </span>
            )}
            {task.entityType && <span className="mt-row-entity">{entityShortLabel(task.entityType)}</span>}
          </span>
        </span>
      </button>
      {!done && canStartFromList(task) && (
        <button
          type="button"
          className="mt-start"
          onClick={() => onStart(task)}
          disabled={starting}
          aria-label={`Start ${task.title}`}
          title="Start — marks it in progress and makes it your current task"
        >
          {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>Start</span>
        </button>
      )}
    </li>
  );
}

export default RailTasks;
