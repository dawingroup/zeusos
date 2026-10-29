/**
 * FocusTodayCard — "Your focus today".
 *
 * The staff end of the daily focus loop: drafted 17:00, shaped by the
 * manager, published 06:00, closed 20:00. Reads ONE plan doc through
 * useTodayPlan; the live task status strikes through what is already done.
 *
 * What it will not do:
 *   - pretend a plan was reviewed. An auto-ranked plan is shown, and the gap
 *     is labelled in amber — always;
 *   - invent items. No plan is an honest empty state, never an empty list;
 *   - hide a fault. A plan that failed to load says so;
 *   - a silent Done. The server closes the task FIRST; when it cannot (an
 *     approval decided on its record, required checks open) the item stays
 *     open and the person is told why.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, Info, Plus, Target, X } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { pushToast } from '@/shared/components/feedback/toastBus';
import { describeCallableError } from '@/shared/utils/callableError';
import { getEntityRoute } from '@/modules/intelligence-layer/utils/getEntityRoute';
import { useTodayPlan, type TodayPlanItem } from '../hooks/useTodayPlan';
import {
  clockOf,
  dayClockOf,
  fmtMins,
  formatPlanDate,
  groupFocusItems,
  initialsOf,
  isWrapUpDue,
  itemState,
  moduleLabelOf,
  nextWorkdayLong,
  priorityChip,
  reasonChip,
  sumTimebox,
  taskInboxUrl,
  wrapUpOutcomes,
  type ChipTone,
} from '../format';
import type { PlanItemOutcome } from '../types';
import { AddOwnTaskDialog } from './AddOwnTaskDialog';
import { BlockedDialog, WrapUpModal } from './FocusDialogs';

const TONE_STYLE: Record<ChipTone, { bg: string; fg: string }> = {
  '': { bg: 'var(--bg-sunken)', fg: 'var(--fg-secondary)' },
  red: { bg: 'var(--rag-red-soft)', fg: 'var(--rag-red)' },
  amber: { bg: 'var(--rag-amber-soft)', fg: 'var(--rag-amber)' },
  blue: { bg: 'var(--rag-blue-soft)', fg: 'var(--rag-blue)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  green: { bg: 'var(--rag-green-soft)', fg: 'var(--rag-green)' },
};

function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const s = TONE_STYLE[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: s.bg, color: s.fg }}>
      {children}
    </span>
  );
}

function itemRoute(item: TodayPlanItem): string {
  return (
    getEntityRoute({ entityType: item.entityType, entityId: item.entityId, sourceModule: item.sourceModule }) ??
    taskInboxUrl(item.taskId)
  );
}

function ItemChips({ item, date }: { item: TodayPlanItem; date: string }) {
  const pri = priorityChip(item.priority);
  const reason = reasonChip(item.focusReason, date);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone={pri.tone}>{pri.label}</Chip>
      <Chip tone={reason.tone}>{reason.label}</Chip>
      {item.timeboxMinutes ? (
        <Chip tone=""><Clock className="h-2.5 w-2.5" aria-hidden="true" />{fmtMins(item.timeboxMinutes)}</Chip>
      ) : null}
    </div>
  );
}

export function FocusTodayCard({ nowMs = Date.now() }: { nowMs?: number }) {
  const navigate = useNavigate();
  const today = useTodayPlan();
  const {
    plan, items, loading, hasPlan, acknowledged, reviewed, acknowledge, recordOutcome, clearOutcome, wrapUp,
    problem, problemDetail, doneCount, uid,
  } = today;
  // Chips and the wrap-up name days relative to the PLAN's date.
  const date = plan?.date ?? today.date;

  const [showDone, setShowDone] = useState(false);
  const [blockFor, setBlockFor] = useState<TodayPlanItem | null>(null);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupFocusItems(items), [items]);
  const nowItem = groups.now;

  if (!uid) {
    return (
      <section className="rounded-[10px] p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} aria-label="Your focus today">
        <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>Sign in to see your focus for today.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-[10px] p-5 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} aria-busy="true" aria-label="Your focus today">
        <div className="h-4 w-40 rounded" style={{ backgroundColor: 'var(--bg-sunken)' }} />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded" style={{ backgroundColor: 'var(--bg-sunken)' }} />)}
        </div>
      </section>
    );
  }

  if (!hasPlan && problem) {
    return (
      <section className="rounded-[10px] p-5 flex items-start gap-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} role="status" data-testid="plan-problem-load_failed">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--rag-amber)' }} aria-hidden="true" />
        <div>
          <p className="text-[13.5px] font-medium" style={{ color: 'var(--fg-primary)' }}>Your plan could not be loaded</p>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--fg-secondary)' }}>This is a fault, not a day without a plan: {problemDetail}.</p>
        </div>
      </section>
    );
  }

  if (!hasPlan) {
    return (
      <section className="rounded-[10px] p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} aria-label="Your focus today" data-testid="focus-empty">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Target className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--fg-primary)' }}>No plan for {formatPlanDate(date)}</h3>
            <p className="text-[12.5px] mt-1" style={{ color: 'var(--fg-secondary)' }}>
              A plan is drafted each evening at 17:00 from your open work and published at 06:00. Add a task of your own and it is drafted in tonight.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddOpen(true)} data-testid="focus-add-own">
              <Plus className="h-3 w-3" aria-hidden="true" /> Add my own task
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate('/intelligence/inbox')}>
              Open My Tasks <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <AddOwnTaskDialog open={addOpen} onOpenChange={setAddOpen} />
      </section>
    );
  }

  const planned = sumTimebox(items);
  const hasManager = Boolean(plan?.managerUid);
  const managerName = plan?.managerName ?? (plan?.reviewed ? plan?.reviewedByName : null) ?? null;
  const acknowledgedAt = clockOf(plan?.acknowledgedAt);
  const wrappedUpAt = clockOf(plan?.wrapUp?.at);
  const canWrapUp = plan?.status === 'published' && !wrappedUpAt;
  const wrapUpDue = isWrapUpDue(plan, nowMs);

  const run = async (what: string, fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.warn('[FocusTodayCard] write failed', err);
      setError(describeCallableError(err, what));
    }
  };

  const markDone = async (item: TodayPlanItem) => {
    setError(null);
    try {
      const res = await recordOutcome(item.taskId, 'done');
      if (!res.ok && res.taskLeftOpen) {
        // Never a silent Done: the item stays open and the person is told why.
        pushToast(`“${item.title}” is still open — ${res.taskLeftOpen}.`, { tone: 'info', durationMs: 7000 });
        navigate(itemRoute(item));
      }
    } catch (err) {
      setError(describeCallableError(err, 'mark it done'));
    }
  };
  const setOutcome = (item: TodayPlanItem, outcome: PlanItemOutcome) => run('record that', () => recordOutcome(item.taskId, outcome));
  const markBlocked = (item: TodayPlanItem, note: string) => recordOutcome(item.taskId, 'blocked', note).then(() => undefined);
  const reopen = (item: TodayPlanItem) => run('reopen it', () => clearOutcome(item.taskId));
  const toggleNumber = (item: TodayPlanItem) => {
    const state = itemState(item);
    if (state === 'done') {
      if (!item.isClosed) void reopen(item);
      return;
    }
    void markDone(item);
  };

  return (
    <section className="rounded-[10px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} aria-label="Your focus today" data-testid="focus-today">
      <div className="px-5 pt-4 pb-3 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-[15px] w-[15px]" style={{ color: 'var(--accent)' }} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold m-0" style={{ color: 'var(--fg-primary)' }}>Your focus today</h2>
            <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>
              {items.length} {items.length === 1 ? 'item' : 'items'}{planned ? ` · ${fmtMins(planned)} planned` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {acknowledged ? (
              <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--rag-green)' }} data-testid="plan-acknowledged">
                <Check className="h-3 w-3" aria-hidden="true" /> Acknowledged{acknowledgedAt ? ` ${acknowledgedAt}` : ''}
              </span>
            ) : (
              <Button variant="primary" size="sm" className="gap-1" onClick={() => void run('acknowledge the plan', acknowledge)} data-testid="plan-acknowledge">
                <Check className="h-3 w-3" aria-hidden="true" /> Got it
              </Button>
            )}
            {wrappedUpAt ? (
              <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>Wrapped up at {wrappedUpAt}</span>
            ) : canWrapUp ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                style={wrapUpDue ? { background: 'var(--rag-amber-soft)', color: 'var(--rag-amber)', borderColor: 'transparent' } : undefined}
                onClick={() => setWrapOpen(true)}
                data-testid="plan-wrapup"
              >
                <Clock className="h-3 w-3" aria-hidden="true" /> Wrap up{wrapUpDue ? ' · due' : ''}
              </Button>
            ) : null}
          </div>
        </div>

        {plan?.dayGoal && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>Day goal</span>
            <p className="m-0 text-[13.5px] font-medium" style={{ color: 'var(--fg-primary)' }}>{plan.dayGoal}</p>
          </div>
        )}

        {plan?.brief && (
          <p className="m-0 text-[12.5px] rounded-[8px] px-3 py-2" style={{ color: 'var(--fg-secondary)', background: 'var(--bg-sunken)' }} data-testid="plan-brief">
            {plan.brief}
          </p>
        )}

        {reviewed ? (
          <div className="flex items-start gap-2 text-[12.5px]" data-testid="plan-reviewed">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white" style={{ background: 'var(--accent)' }} aria-hidden="true">
              {initialsOf(plan?.reviewedByName)}
            </span>
            <div style={{ color: 'var(--fg-secondary)' }}>
              <b style={{ color: 'var(--fg-primary)' }}>{plan?.reviewedByName || 'Your manager'}</b>{' '}
              reviewed your plan{dayClockOf(plan?.reviewedAt) ? ` · ${dayClockOf(plan?.reviewedAt)}` : ''}
              {plan?.managerNote && (<><br />{plan.managerNote}</>)}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-[12.5px]" data-testid="plan-unreviewed">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--rag-amber)' }} aria-hidden="true" />
            <div style={{ color: 'var(--fg-secondary)' }}>
              <b style={{ color: 'var(--rag-amber)' }}>Auto-generated · not yet reviewed.</b>{' '}
              {hasManager
                ? `${managerName || 'Your manager'} hasn’t shaped this plan — it’s ranked from your open work by due date and priority.`
                : 'Nobody has shaped this plan — it’s ranked from your open work by due date and priority.'}
              {plan?.managerNote && (<><br />{plan.managerNote}</>)}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {items.map((item) => {
              const s = itemState(item);
              const color = s === 'done' ? 'var(--rag-green)' : s === 'blocked' ? 'var(--rag-red)' : s === 'open' && item.taskId === nowItem?.taskId ? 'var(--accent)' : s === 'open' ? 'var(--border-strong)' : 'var(--rag-amber)';
              return <span key={item.taskId} title={item.title} className="h-1.5 flex-1 rounded-full" style={{ background: color }} />;
            })}
          </div>
          <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--fg-tertiary)' }} data-testid="focus-progress">{doneCount}/{items.length} done</span>
        </div>
        {error && <p role="alert" className="m-0 text-[12px]" style={{ color: 'var(--rag-red)' }}>{error}</p>}
      </div>

      {nowItem ? (
        <div className="px-5 py-4 space-y-3" style={{ background: 'var(--bg-app)' }} data-testid="focus-now">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--accent)' }}>
            Now · {items.indexOf(nowItem) + 1} of {items.length}
          </span>
          <div>
            <h3 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--fg-primary)' }}>{nowItem.title}</h3>
            <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>
              {nowItem.entityRef ? `${nowItem.entityRef} · ` : ''}{moduleLabelOf(nowItem.sourceModule)}
            </span>
          </div>
          <ItemChips item={nowItem} date={date} />
          {(nowItem.whyToday || nowItem.resumeNote) && (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
              {nowItem.whyToday && (<><dt style={{ color: 'var(--fg-tertiary)' }}>Why today</dt><dd className="m-0" style={{ color: 'var(--fg-primary)' }}>{nowItem.whyToday}</dd></>)}
              {nowItem.resumeNote && (<><dt style={{ color: 'var(--fg-tertiary)' }}>Where you left it</dt><dd className="m-0" style={{ color: 'var(--fg-primary)' }}>{nowItem.resumeNote}</dd></>)}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1" onClick={() => navigate(itemRoute(nowItem))} data-testid="focus-open">
              Open in {moduleLabelOf(nowItem.sourceModule)} <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => void markDone(nowItem)} data-testid="focus-done">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Done
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void setOutcome(nowItem, 'carried')}>Carry</Button>
            <Button variant="ghost" size="sm" onClick={() => setBlockFor(nowItem)} data-testid="focus-block">Blocked…</Button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-2" style={{ background: 'var(--bg-app)' }} data-testid="focus-cleared">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--rag-green)' }}>
            <Check className="h-3 w-3" aria-hidden="true" /> Plan cleared
          </span>
          <h3 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--fg-primary)' }}>Everything on today’s plan is closed.</h3>
          <div className="flex gap-2">
            {canWrapUp && <Button size="sm" onClick={() => setWrapOpen(true)}>Wrap up the day</Button>}
            <Button variant="outline" size="sm" onClick={() => navigate('/intelligence/inbox')}>Pick from My Tasks</Button>
          </div>
        </div>
      )}

      <div className="px-5 py-3 space-y-1.5">
        {groups.upNext.length > 0 && <SectionLabel>Up next{sumTimebox(groups.upNext) ? ` · ${fmtMins(sumTimebox(groups.upNext))}` : ''}</SectionLabel>}
        {groups.upNext.map((item) => (
          <FocusRow key={item.taskId} item={item} n={items.indexOf(item) + 1} date={date}
            onToggle={() => toggleNumber(item)} onOpen={() => navigate(itemRoute(item))}
            onCarry={() => void setOutcome(item, 'carried')} onBlock={() => setBlockFor(item)} />
        ))}
        {groups.parked.length > 0 && <SectionLabel>Parked · {groups.parked.length}</SectionLabel>}
        {groups.parked.map((item) => (
          <FocusRow key={item.taskId} item={item} n={items.indexOf(item) + 1} date={date}
            onToggle={() => toggleNumber(item)} onOpen={() => navigate(itemRoute(item))} onReopen={() => void reopen(item)} />
        ))}
        {groups.done.length > 0 && (
          <button type="button" className="inline-flex items-center gap-1 text-[12px] bg-transparent border-0 p-0 cursor-pointer" style={{ color: 'var(--fg-tertiary)' }} onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            {showDone ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            {groups.done.length} done
          </button>
        )}
        {showDone && groups.done.map((item) => (
          <FocusRow key={item.taskId} item={item} n={items.indexOf(item) + 1} date={date}
            onToggle={() => toggleNumber(item)} onOpen={() => navigate(itemRoute(item))} />
        ))}
        <div className="pt-1">
          <Button variant="ghost" size="sm" className="gap-1 px-1" onClick={() => setAddOpen(true)} data-testid="focus-add-own">
            <Plus className="h-3 w-3" aria-hidden="true" /> Add my own task
          </Button>
        </div>
      </div>

      <BlockedDialog
        open={Boolean(blockFor)}
        title={blockFor?.title}
        managerName={managerName}
        hasManager={hasManager}
        onClose={() => setBlockFor(null)}
        onSubmit={async (note) => { if (blockFor) await markBlocked(blockFor, note); }}
      />
      <WrapUpModal
        open={wrapOpen}
        date={date}
        items={items}
        managerName={managerName}
        hasManager={hasManager}
        onClose={() => setWrapOpen(false)}
        onSubmit={async (summary, blockers) => {
          const { notClosed } = await wrapUp(wrapUpOutcomes(items), summary, blockers);
          for (const n of notClosed) pushToast(`“${n.title}” was carried, not closed: ${n.reason}.`, { tone: 'info', durationMs: 8000 });
        }}
      />
      <AddOwnTaskDialog open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>{children}</div>;
}

function FocusRow({ item, n, date, onToggle, onOpen, onCarry, onBlock, onReopen }: {
  item: TodayPlanItem;
  n: number;
  date: string;
  onToggle: () => void;
  onOpen: () => void;
  onCarry?: () => void;
  onBlock?: () => void;
  onReopen?: () => void;
}) {
  const state = itemState(item);
  const note =
    state === 'blocked' ? `Blocked — ${item.outcomeNote || 'no note'}`
      : state === 'carried' ? `Carried to ${nextWorkdayLong(date)}${item.outcomeNote ? ` — ${item.outcomeNote}` : ''}`
        : state === 'dropped' ? `Dropped${item.outcomeNote ? ` — ${item.outcomeNote}` : ''}`
          : null;
  const toggleTitle = state === 'done' ? (item.isClosed ? 'The task is closed' : 'Reopen') : 'Mark done';
  const numStyle: React.CSSProperties =
    state === 'done' ? { background: 'var(--rag-green)', color: '#fff', borderColor: 'var(--rag-green)' }
      : state === 'blocked' ? { background: 'var(--rag-red-soft)', color: 'var(--rag-red)', borderColor: 'var(--rag-red)' }
        : state === 'open' ? { background: 'var(--bg-surface)', color: 'var(--fg-secondary)', borderColor: 'var(--border-default)' }
          : { background: 'var(--rag-amber-soft)', color: 'var(--rag-amber)', borderColor: 'var(--rag-amber)' };

  return (
    <div
      className="flex items-start gap-3 rounded-[8px] px-2 py-2 cursor-pointer"
      style={{ opacity: state === 'done' ? 0.6 : 1 }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
      data-testid={`focus-row-${item.taskId}`}
    >
      <button
        type="button"
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums"
        style={numStyle}
        title={toggleTitle}
        aria-label={`${toggleTitle}: ${item.title}`}
        disabled={state === 'done' && item.isClosed}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {state === 'done' ? <Check className="h-3 w-3" aria-hidden="true" /> : state === 'blocked' ? <X className="h-[11px] w-[11px]" aria-hidden="true" /> : n}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium" style={{ color: 'var(--fg-primary)', textDecoration: state === 'done' ? 'line-through' : 'none' }}>{item.title}</div>
        {note ? <div className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>{note}</div> : state !== 'done' && <div className="mt-1"><ItemChips item={item} date={date} /></div>}
      </div>
      {state !== 'done' && (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {state === 'open' ? (
            <>
              {onCarry && <Button variant="ghost" size="sm" onClick={onCarry}>Carry</Button>}
              {onBlock && <Button variant="ghost" size="sm" onClick={onBlock}>Blocked</Button>}
            </>
          ) : (
            onReopen && <Button variant="ghost" size="sm" onClick={onReopen}>Reopen</Button>
          )}
        </div>
      )}
    </div>
  );
}

export default FocusTodayCard;
