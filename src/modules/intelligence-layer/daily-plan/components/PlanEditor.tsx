/**
 * PlanEditor — the manager's evening review of one person's day.
 *
 * Built around the single decision it exists to capture: given everything
 * this person could do tomorrow, what are the few things they should? It
 * opens on the draft, makes reordering and trimming cheap, and ends on one
 * button — "Mark reviewed" — that turns an auto-ranked list into an agreed
 * contract.
 *
 * Two things it shows that a plain task list cannot: yesterday's wrap-up, so
 * the manager plans against what actually happened, and which items are
 * carry-overs, so repeated slippage is visible rather than absorbed.
 *
 * Edits are held locally and written on save through `dailyPlanAction`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, Clock, Info, PenLine, Plus, Save, Search, Sparkles, Target, Undo2, X } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { describeCallableError } from '@/shared/utils/callableError';
import {
  FOCUS_REASON_LABEL, FOCUS_REASON_TONE, clockOf, fmtMins, formatPlanDate, priorityLabel, priorityTone, sumTimebox, toMs,
} from '../format';
import type { DirectReport } from '../hooks/useDirectReports';
import { createEmptyPlan, markReviewed, savePlanItems, savePlanNotes } from '../services/dailyPlanService';
import { fetchAssigneeOpenTasks } from '../services/tasksService';
import { createTaskFn, draftTasksWithAiFn, type AiTaskDraft } from '../services/taskEngineFunctions';
import type { DailyPlan, DailyPlanItem, FocusReason, TaskPriority, TaskRecord } from '../types';

const TIMEBOX_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240];

export function PlanEditor({
  person,
  plan: planProp,
  date,
  yesterday,
  onSaved,
  onPlanStarted,
}: {
  person: DirectReport;
  plan: DailyPlan | null;
  date: string;
  /** The person's plan for the previous working day — what actually happened. */
  yesterday?: DailyPlan | null;
  onSaved: () => void;
  onPlanStarted?: () => void;
}) {
  const [startedPlan, setStartedPlan] = useState<DailyPlan | null>(null);
  const plan = planProp ?? (startedPlan && startedPlan.date === date && startedPlan.assigneeUid === person.uid ? startedPlan : null);
  const [starting, setStarting] = useState(false);

  const [items, setItems] = useState<DailyPlanItem[]>(plan?.items || []);
  const [dayGoal, setDayGoal] = useState(plan?.dayGoal || '');
  const [managerNote, setManagerNote] = useState(plan?.managerNote || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);

  // Reset whenever a different person or date is selected — never carry one
  // person's unsaved edits onto another's plan. A fresh copy of the SAME plan
  // must not wipe what was added meanwhile.
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${person.id}|${date}|${plan?.id ?? ''}`;
    const samePlan = loadedKeyRef.current === key;
    loadedKeyRef.current = key;
    if (samePlan && dirtyRef.current) return;
    setItems([...(plan?.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    setDayGoal(plan?.dayGoal || '');
    setManagerNote(plan?.managerNote || '');
    setDirty(false);
    setError(null);
  }, [plan, person.id, date]);

  const move = (taskId: string, dir: -1 | 1) => {
    setItems((prev) => {
      const from = prev.findIndex((i) => i.taskId === taskId);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setDirty(true);
  };
  const setTimebox = (taskId: string, minutes: number | undefined) => {
    setItems((prev) => prev.map((i) => {
      if (i.taskId !== taskId) return i;
      const next = { ...i };
      if (minutes === undefined) delete next.timeboxMinutes; else next.timeboxMinutes = minutes;
      return next;
    }));
    setDirty(true);
  };
  const removeItem = (taskId: string) => {
    setItems((prev) => prev.filter((i) => i.taskId !== taskId));
    setDirty(true);
  };
  const addTask = (task: TaskRecord) => {
    setItems((prev) => [
      ...prev,
      {
        taskId: task.id,
        order: prev.length,
        title: task.title || 'Task',
        priority: task.priority,
        focusReason: 'manager_pick' as FocusReason,
        ...(task.dueAt ? { dueAt: task.dueAt } : {}),
        ...(task.kind ? { kind: task.kind } : {}),
        ...(task.sourceModule ? { sourceModule: task.sourceModule } : {}),
        ...(task.entityType ? { entityType: task.entityType } : {}),
        ...(task.entityId ? { entityId: task.entityId } : {}),
        ...(task.entityName ? { entityRef: task.entityName } : {}),
        ...(task.estimateMinutes ? { timeboxMinutes: task.estimateMinutes } : {}),
        ...(task.aiUrgencyReason ? { whyToday: task.aiUrgencyReason } : {}),
      },
    ]);
    setDirty(true);
  };

  const startPlan = async () => {
    if (!person.uid) return;
    setStarting(true);
    setError(null);
    try {
      const res = await createEmptyPlan(date, person.uid, person.name);
      if (res.plan) setStartedPlan(res.plan);
      onPlanStarted?.();
    } catch (err) {
      setError(describeCallableError(err, 'start a plan'));
    } finally {
      setStarting(false);
    }
  };

  const persist = async (alsoReview: boolean) => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      await savePlanItems(date, plan.assigneeUid, items);
      if (alsoReview) await markReviewed(date, plan.assigneeUid, { dayGoal, managerNote });
      else await savePlanNotes(date, plan.assigneeUid, { dayGoal, managerNote });
      setDirty(false);
      onSaved();
    } catch (err) {
      setError(describeCallableError(err, alsoReview ? 'mark the plan reviewed' : 'save the plan'));
    } finally {
      setSaving(false);
    }
  };

  const plannedTime = sumTimebox(items);
  const carryOvers = items.filter((i) => i.focusReason === 'carry_over').length;
  const reviewedAt = clockOf(plan?.reviewedAt);

  if (!person.uid) {
    return (
      <Empty title={`${person.name} has no ZeusOS login`} body="Plans are keyed by the person’s sign-in. Link their employee record to a login (HR → Employees → System Access) and they will be drafted in tonight." />
    );
  }

  if (!plan) {
    return (
      <div className="rounded-[10px] py-16 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} data-testid="plan-editor-empty">
        <Target className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--fg-quaternary)' }} />
        <p className="font-medium text-[13.5px]" style={{ color: 'var(--fg-primary)' }}>No plan drafted for {person.name}</p>
        <p className="text-[12px] mt-1 max-w-md mx-auto" style={{ color: 'var(--fg-tertiary)' }}>
          The 17:00 draft only creates a plan for people with open tasks. Start one here to add their existing work or draft a new task for them.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => void startPlan()} disabled={starting} data-testid="plan-start">
            <Plus className="h-3.5 w-3.5" />
            {starting ? 'Starting…' : `Start a plan for ${person.name.split(' ')[0]}`}
          </Button>
        </div>
        {error && <p className="mt-3 text-[12px]" style={{ color: 'var(--rag-red)' }}>{error}</p>}
      </div>
    );
  }

  const locked = saving;

  return (
    <div className="space-y-3" data-testid="plan-editor">
      <div className="rounded-[10px] px-4 py-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold m-0" style={{ color: 'var(--fg-primary)' }}>{person.name}</h2>
            <p className="text-[12px] mt-0.5 m-0" style={{ color: 'var(--fg-tertiary)' }}>
              {person.jobTitle || 'Team member'} · {formatPlanDate(date)} · {items.length} {items.length === 1 ? 'item' : 'items'}
              {plannedTime ? ` · ${fmtMins(plannedTime)} planned` : ''}
              {carryOvers > 0 ? ` · ${carryOvers} carried over` : ''}
            </p>
            {plan.reviewed ? (
              <span className="mt-1 inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--rag-green)' }} data-testid="plan-editor-reviewed">
                <CheckCircle2 className="h-3 w-3" /> Reviewed{plan.reviewedByName ? ` by ${plan.reviewedByName}` : ''}{reviewedAt ? ` at ${reviewedAt}` : ''}
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--rag-amber)' }}>
                <Info className="h-3 w-3" /> Not reviewed — they will see it labelled as auto-generated
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={saving} onClick={() => {
                setItems([...(plan.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
                setDayGoal(plan.dayGoal || '');
                setManagerNote(plan.managerNote || '');
                setDirty(false);
              }}>
                <Undo2 className="h-3.5 w-3.5" /> Discard
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void persist(false)} disabled={locked} data-testid="plan-save">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => void persist(true)} disabled={locked || items.length === 0} data-testid="plan-mark-reviewed">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : plan.reviewed ? 'Re-confirm' : 'Mark reviewed'}
            </Button>
          </div>
        </div>
        {error && <p role="alert" className="mt-2 text-[12px] m-0" style={{ color: 'var(--rag-red)' }}>{error}</p>}
      </div>

      {yesterday && <YesterdaySummary plan={yesterday} />}

      <div className="rounded-[10px] px-4 py-3 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>The day in one line</label>
          <Input value={dayGoal} onChange={(e) => { setDayGoal(e.target.value); setDirty(true); }} placeholder="e.g. Get the Safaricom deck to the ECD and the invoice out" className="mt-1 h-8 text-[12.5px]" data-testid="plan-day-goal" />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>Note to them (optional)</label>
          <Textarea value={managerNote} onChange={(e) => { setManagerNote(e.target.value); setDirty(true); }} placeholder="Anything they need to know before they start." className="mt-1 text-[12.5px]" rows={2} />
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-[10px] px-4 py-6 text-center text-[12.5px] m-0" style={{ backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-default)', color: 'var(--fg-tertiary)' }}>
            Nothing on the plan. Add at least one thing before marking it reviewed.
          </p>
        ) : (
          items.map((item, index) => (
            <PlanItemRow key={item.taskId} item={item} index={index} count={items.length}
              onMove={move} onTimeboxChange={setTimebox} onRemove={removeItem} disabled={locked} />
          ))
        )}

        <AddTaskPicker uid={person.uid} excludeTaskIds={items.map((i) => i.taskId)} onAdd={addTask} disabled={locked} />

        <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setDraftOpen(true)} disabled={locked}>
          <PenLine className="h-3.5 w-3.5" /> Draft a new task for {person.name.split(' ')[0]}
        </Button>

        {draftOpen && (
          <DraftTaskForm
            person={person}
            planDate={date}
            onClose={() => setDraftOpen(false)}
            onDrafted={(item) => { setItems((prev) => [...prev, { ...item, order: prev.length }]); setDirty(true); setDraftOpen(false); }}
          />
        )}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[10px] py-16 text-center px-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <Target className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--fg-quaternary)' }} />
      <p className="font-medium text-[13.5px] m-0" style={{ color: 'var(--fg-primary)' }}>{title}</p>
      <p className="text-[12px] mt-1 max-w-md mx-auto" style={{ color: 'var(--fg-tertiary)' }}>{body}</p>
    </div>
  );
}

/** One commitment: order is the message, so moving it is as cheap as thinking. */
function PlanItemRow({ item, index, count, onMove, onTimeboxChange, onRemove, disabled }: {
  item: DailyPlanItem;
  index: number;
  count: number;
  onMove: (taskId: string, dir: -1 | 1) => void;
  onTimeboxChange: (taskId: string, minutes: number | undefined) => void;
  onRemove: (taskId: string) => void;
  disabled?: boolean;
}) {
  const reason = (item.focusReason || 'auto_rank') as FocusReason;
  return (
    <div className="rounded-[8px] px-3 py-2.5 flex items-start gap-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} data-testid={`plan-item-${item.taskId}`}>
      <div className="flex flex-col gap-0.5">
        <button type="button" className="h-5 w-5 inline-flex items-center justify-center rounded bg-transparent border-0 cursor-pointer disabled:opacity-30" style={{ color: 'var(--fg-tertiary)' }} aria-label={`Move ${item.title} up`} disabled={disabled || index === 0} onClick={() => onMove(item.taskId, -1)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="h-5 w-5 inline-flex items-center justify-center rounded bg-transparent border-0 cursor-pointer disabled:opacity-30" style={{ color: 'var(--fg-tertiary)' }} aria-label={`Move ${item.title} down`} disabled={disabled || index === count - 1} onClick={() => onMove(item.taskId, 1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-semibold tabular-nums" style={{ backgroundColor: 'var(--bg-sunken)', color: 'var(--fg-secondary)' }}>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium m-0" style={{ color: 'var(--fg-primary)' }}>{item.title}</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
          <span style={{ color: priorityTone(item.priority) }}>{priorityLabel(item.priority)}</span>
          <span style={{ color: 'var(--fg-quaternary)' }}>·</span>
          <span style={{ color: FOCUS_REASON_TONE[reason] }}>{FOCUS_REASON_LABEL[reason]}</span>
          {item.entityRef && (<><span style={{ color: 'var(--fg-quaternary)' }}>·</span><span style={{ color: 'var(--fg-tertiary)' }}>{item.entityRef}</span></>)}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="inline-flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
          <Clock className="h-3 w-3" />
          <select
            value={item.timeboxMinutes ? String(item.timeboxMinutes) : 'none'}
            onChange={(e) => onTimeboxChange(item.taskId, e.target.value === 'none' ? undefined : Number(e.target.value))}
            disabled={disabled}
            className="h-7 rounded-md border px-1 text-[11.5px]"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }}
            aria-label={`Timebox for ${item.title}`}
          >
            <option value="none">No timebox</option>
            {TIMEBOX_CHOICES.map((m) => <option key={m} value={String(m)}>{m < 60 ? `${m}m` : `${m / 60}h`}</option>)}
          </select>
        </label>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(item.taskId)} disabled={disabled} aria-label={`Remove ${item.title} from the plan`}>
          <X className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />
        </Button>
      </div>
    </div>
  );
}

/** Pull something from the person's wider queue onto the plan — stamped `manager_pick`. */
function AddTaskPicker({ uid, excludeTaskIds, onAdd, disabled }: {
  uid: string;
  excludeTaskIds: string[];
  onAdd: (task: TaskRecord) => void;
  disabled?: boolean;
}) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    fetchAssigneeOpenTasks([uid])
      .then((next) => { if (request === requestRef.current) setTasks(next); })
      .catch((err) => { if (request === requestRef.current) { setError(err instanceof Error ? err.message : 'Could not load tasks'); setTasks([]); } })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
  }, [uid]);

  const excluded = useMemo(() => new Set(excludeTaskIds), [excludeTaskIds]);
  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => !excluded.has(t.id)).filter((t) => (term ? (t.title || '').toLowerCase().includes(term) : true));
  }, [tasks, excluded, search]);

  return (
    <div className="rounded-[8px] p-3" style={{ backgroundColor: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }} data-testid="add-task-picker">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />
          <Input placeholder="Add from their open work…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-[12.5px]" disabled={disabled} />
        </div>
        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--fg-tertiary)' }}>{loading ? 'loading…' : `${available.length} available`}</span>
      </div>
      {error && <p className="mt-2 text-[12px] m-0" style={{ color: 'var(--rag-red)' }}>{error}</p>}
      {!loading && available.length === 0 && (
        <p className="mt-2 text-[12px] m-0" style={{ color: 'var(--fg-tertiary)' }}>
          {tasks.length === 0 ? 'This person has no other open tasks.' : 'Everything open is already on the plan.'}
        </p>
      )}
      {available.length > 0 && (
        <div className="mt-2 max-h-[260px] overflow-y-auto space-y-1">
          {available.map((task) => (
            <button key={task.id} type="button" onClick={() => onAdd(task)} disabled={disabled} className="w-full text-left px-2.5 py-1.5 rounded-[6px] flex items-center gap-2 border-0 bg-transparent cursor-pointer hover:bg-[var(--bg-surface)]" data-testid={`pick-task-${task.id}`}>
              <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--fg-primary)' }}>{task.title}</span>
              {task.dueAt && toMs(task.dueAt) != null && <span className="text-[11px] shrink-0" style={{ color: 'var(--fg-tertiary)' }}>{formatPlanDate(task.dueAt.slice(0, 10))}</span>}
              <span className="text-[11px] shrink-0" style={{ color: priorityTone(task.priority) }}>{priorityLabel(task.priority)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Write a new task during the review and put it straight on the plan.
 * "Draft with AI" turns the intent into editable suggestions (dark without an
 * Anthropic key — the form still works by hand).
 */
function DraftTaskForm({ person, planDate, onClose, onDrafted }: {
  person: DirectReport;
  planDate: string;
  onClose: () => void;
  onDrafted: (item: DailyPlanItem) => void;
}) {
  const [title, setTitle] = useState('');
  const [intent, setIntent] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('P1');
  const [timebox, setTimebox] = useState<number | undefined>(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AiTaskDraft[] | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const suggest = async () => {
    const text = [title.trim(), intent.trim()].filter(Boolean).join(' — ');
    if (!text || !person.uid) return;
    setSuggesting(true);
    setAiNote(null);
    try {
      const res = await draftTasksWithAiFn({ intent: text, assigneeUid: person.uid, planDate });
      setSuggestions(res.data.drafts);
      if (res.data.drafts.length === 0) setAiNote('Nothing came back — try saying what done looks like.');
    } catch (err) {
      setSuggestions(null);
      setAiNote(describeCallableError(err, 'draft with AI'));
    } finally {
      setSuggesting(false);
    }
  };

  const useSuggestion = (d: AiTaskDraft) => {
    setTitle(d.title);
    setIntent(d.description || '');
    setPriority(d.priority);
    setTimebox(d.estimateMinutes || undefined);
    setSuggestions(null);
  };

  const draft = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || !person.uid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createTaskFn({
        title: cleanTitle,
        description: intent.trim() || `Drafted during the ${formatPlanDate(planDate)} plan review.`,
        priority,
        kind: 'action',
        dueDate: planDate,
        assigneeId: person.uid,
        ...(timebox ? { estimateMinutes: timebox } : {}),
        sourceModule: 'manual',
      });
      onDrafted({
        taskId: res.data.id,
        order: 0,
        title: cleanTitle,
        priority,
        focusReason: 'manager_pick',
        kind: 'action',
        sourceModule: 'manual',
        ...(timebox ? { timeboxMinutes: timebox } : {}),
      });
    } catch (err) {
      setError(describeCallableError(err, 'draft the task'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[8px] p-3 space-y-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent)' }} data-testid="draft-task-form">
      <div className="text-[12.5px] font-semibold" style={{ color: 'var(--fg-primary)' }}>Draft a task for {person.name}</div>
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen" className="h-8 text-[12.5px]" data-testid="draft-task-title" />
      <Textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={2} className="text-[12.5px]" placeholder="Why it matters — what it unblocks, who is waiting (optional)" data-testid="draft-task-intent" />
      <div className="flex gap-2 flex-wrap">
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="h-8 rounded-md border px-2 text-[12.5px]" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }} aria-label="Priority">
          <option value="P0">Critical — today, ahead of everything</option>
          <option value="P1">High — should land that day</option>
          <option value="P2">Medium</option>
          <option value="P3">Low</option>
        </select>
        <select value={timebox ? String(timebox) : 'none'} onChange={(e) => setTimebox(e.target.value === 'none' ? undefined : Number(e.target.value))} className="h-8 rounded-md border px-2 text-[12.5px]" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }} aria-label="Timebox">
          <option value="none">No timebox</option>
          {TIMEBOX_CHOICES.map((m) => <option key={m} value={String(m)}>{m < 60 ? `${m}m` : `${m / 60}h`}</option>)}
        </select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void suggest()} disabled={suggesting || saving || !(title.trim() || intent.trim())} title="Turn the intent into one to five editable drafts" data-testid="draft-task-ai">
          <Sparkles className="h-3.5 w-3.5" /> {suggesting ? 'Drafting…' : 'Draft with AI'}
        </Button>
      </div>
      {aiNote && <p className="text-[12px] m-0" style={{ color: 'var(--fg-tertiary)' }} data-testid="draft-task-ai-note">{aiNote}</p>}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-1" data-testid="draft-task-suggestions">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>Suggested — pick one to edit</div>
          {suggestions.map((d, i) => (
            <button key={i} type="button" onClick={() => useSuggestion(d)} className="w-full text-left px-2.5 py-1.5 rounded-[6px] border-0 cursor-pointer hover:bg-[var(--bg-sunken)]" style={{ background: 'var(--bg-app)' }} data-testid={`draft-task-suggestion-${i}`}>
              <span className="block text-[12.5px] font-medium" style={{ color: 'var(--fg-primary)' }}>{d.title}</span>
              <span className="block text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                {priorityLabel(d.priority)} · {fmtMins(d.estimateMinutes)}{d.why ? ` · ${d.why}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-[12px] m-0" style={{ color: 'var(--rag-red)' }}>{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" size="sm" className="gap-1.5" onClick={() => void draft()} disabled={saving || !title.trim()} data-testid="draft-task-submit">
          <PenLine className="h-3.5 w-3.5" /> {saving ? 'Drafting…' : 'Draft and add to plan'}
        </Button>
      </div>
    </div>
  );
}

/** Yesterday in one strip — plan against reality, not intent. */
function YesterdaySummary({ plan }: { plan: DailyPlan }) {
  const items = plan.items || [];
  const counts = useMemo(() => ({
    done: items.filter((i) => i.outcome === 'done').length,
    carried: items.filter((i) => i.outcome === 'carried').length,
    blocked: items.filter((i) => i.outcome === 'blocked').length,
  }), [items]);
  if (items.length === 0) return null;
  return (
    <div className="rounded-[10px] px-4 py-2.5" style={{ backgroundColor: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }} data-testid="yesterday-summary">
      <div className="flex items-center gap-3 flex-wrap text-[12px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>{formatPlanDate(plan.date)}</span>
        <span style={{ color: 'var(--rag-green)' }}>{counts.done} done</span>
        {counts.carried > 0 && <span style={{ color: 'var(--rag-amber)' }}>{counts.carried} carried</span>}
        {counts.blocked > 0 && <span style={{ color: 'var(--rag-red)' }}>{counts.blocked} blocked</span>}
        {!plan.acknowledgedAt && <span style={{ color: 'var(--fg-tertiary)' }}>not acknowledged</span>}
      </div>
      {plan.wrapUp?.summary && <p className="mt-1 text-[12.5px] m-0" style={{ color: 'var(--fg-secondary)' }}>“{plan.wrapUp.summary}”</p>}
      {plan.wrapUp?.blockers && <p className="mt-1 text-[12.5px] m-0" style={{ color: 'var(--rag-red)' }}>Blocked on: {plan.wrapUp.blockers}</p>}
    </div>
  );
}

export default PlanEditor;
