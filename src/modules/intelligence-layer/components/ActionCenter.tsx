/**
 * ActionCenter — floating "needs a person now" panel (UI Refresh v3,
 * handoff README §"Action Center").
 *
 * Surfaces the highest-urgency open work assigned to the current user and
 * lets them act on it without leaving the page. Unlike the design prototype
 * (which was mock-seeded), this is wired to **real data**:
 *
 *   - Source: `useEmployeeTaskInbox()` — the AI task engine's real-time
 *     subscription of `EmployeeTask`s assigned to the caller (Phase F).
 *   - Urgency: derived from each task's `priority` (P0 = blocking, P1 =
 *     urgent, else for-info) and overdue/soon `dueDate`.
 *   - Resolve: calls the hook's real `completeTask(id)` mutation.
 *   - Dismiss: local (localStorage) — hides an item without completing it;
 *     the canonical task lifecycle stays server-side.
 *
 * Top-right, below the two-row header. Collapsed/dismissed state persists in
 * localStorage. Renders nothing until there is at least one open task, so it
 * never adds chrome to an empty inbox.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, X, ClipboardCheck, ArrowUpRight, Flame } from 'lucide-react';
import {
  useEmployeeTaskInbox,
  type EmployeeTask,
} from '@/modules/intelligence-layer/hooks/useEmployeeTaskInbox';

const LS_DISMISSED = 'zeus_ac_dismissed_v1';
const LS_OPEN = 'zeus_ac_open_v1';
const OPEN_STATUSES: EmployeeTask['status'][] = ['pending', 'in_progress', 'blocked'];

type Urgency = 'blocking' | 'urgent' | 'info';
const URGENCY: Record<Urgency, { label: string; color: string; soft: string; pill: string }> = {
  blocking: { label: 'Blocking', color: 'var(--rag-red)', soft: 'var(--rag-red-soft)', pill: 'red' },
  urgent: { label: 'Urgent', color: 'var(--rag-amber)', soft: 'var(--rag-amber-soft)', pill: 'amber' },
  info: { label: 'For info', color: 'var(--rag-blue)', soft: 'var(--rag-blue-soft)', pill: 'blue' },
};

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

/** Derive Action-Center urgency from a task's priority + due date. Exported
 *  for unit testing. */
export function urgencyOf(t: EmployeeTask, nowMs: number): Urgency {
  const overdue = t.dueDate ? t.dueDate.getTime() < nowMs : false;
  const dueSoon = t.dueDate ? t.dueDate.getTime() - nowMs < 24 * 60 * 60 * 1000 : false;
  if (t.priority === 'P0' || t.status === 'blocked' || overdue) return 'blocking';
  if (t.priority === 'P1' || dueSoon) return 'urgent';
  return 'info';
}

function ageLabel(d?: Date, nowMs = Date.now()): string {
  if (!d) return '';
  const mins = Math.max(0, Math.round((nowMs - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function ActionCenter() {
  const navigate = useNavigate();
  const { tasks, loading, completeTask } = useEmployeeTaskInbox();

  const [dismissed, setDismissed] = useState<Set<string>>(() => loadSet(LS_DISMISSED));
  const [open, setOpen] = useState<boolean>(() => localStorage.getItem(LS_OPEN) !== '0');
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => saveSet(LS_DISMISSED, dismissed), [dismissed]);
  useEffect(() => localStorage.setItem(LS_OPEN, open ? '1' : '0'), [open]);

  const nowMs = useMemo(() => Date.now(), [tasks]);

  const visible = useMemo(() => {
    return tasks
      .filter((t) => OPEN_STATUSES.includes(t.status) && !dismissed.has(t.id))
      .map((t) => ({ task: t, urgency: urgencyOf(t, nowMs) }))
      .sort((a, b) => {
        const rank: Record<Urgency, number> = { blocking: 0, urgent: 1, info: 2 };
        if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
        const av = a.task.dueDate ? a.task.dueDate.getTime() : Number.POSITIVE_INFINITY;
        const bv = b.task.dueDate ? b.task.dueDate.getTime() : Number.POSITIVE_INFINITY;
        return av - bv;
      });
  }, [tasks, dismissed, nowMs]);

  const blockingCount = visible.filter((v) => v.urgency === 'blocking').length;

  const dismiss = useCallback((id: string) => {
    setLeaving(id);
    window.setTimeout(() => {
      setDismissed((prev) => new Set(prev).add(id));
      setLeaving(null);
    }, 320);
  }, []);

  const resolve = useCallback(
    async (id: string) => {
      setLeaving(id);
      try {
        await completeTask(id);
      } catch {
        /* completeTask surfaces its own errors; keep the item if it failed */
      } finally {
        window.setTimeout(() => {
          setDismissed((prev) => new Set(prev).add(id));
          setLeaving(null);
        }, 320);
      }
    },
    [completeTask],
  );

  // Render nothing until there's open work — never add chrome to an empty inbox.
  if (loading || visible.length === 0) return null;

  // Collapsed pill
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="action-center-pill"
        style={{
          position: 'fixed', top: 116, right: 24, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 14px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 100, boxShadow: 'var(--shadow-lg)', cursor: 'pointer',
          color: 'var(--fg-primary)', font: 'inherit', fontSize: 13, fontWeight: 600,
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Bell size={16} />
          <span
            style={{
              position: 'absolute', top: -6, right: -7, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 100, background: blockingCount ? 'var(--rag-red)' : 'var(--zeus-red)', color: '#fff',
              fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {visible.length}
          </span>
        </span>
        {visible.length} need{visible.length === 1 ? 's' : ''} you
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      data-testid="action-center-panel"
      style={{
        position: 'fixed', top: 116, right: 24, zIndex: 60, width: 352,
        maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Bell size={16} style={{ color: 'var(--fg-primary)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.1 }}>Action Center</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 1 }}>
            {visible.length} item{visible.length > 1 ? 's' : ''} need you
            {blockingCount ? ` · ${blockingCount} blocking` : ''}
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} title="Collapse" className="btn btn-ghost" style={{ padding: 6 }}>
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(({ task: t, urgency }) => {
          const u = URGENCY[urgency];
          const isLeaving = leaving === t.id;
          const blocked = t.status === 'blocked';
          return (
            <div
              key={t.id}
              data-testid={`action-item-${t.id}`}
              style={{
                position: 'relative', padding: '11px 13px 12px 15px', borderRadius: 10,
                background: 'var(--bg-app)', border: '1px solid var(--border-subtle)',
                boxShadow: `inset 3px 0 0 ${u.color}`,
                opacity: isLeaving ? 0 : 1, transform: isLeaving ? 'translateX(12px)' : 'none',
                transition: 'opacity 320ms ease, transform 320ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <span
                  style={{
                    width: 24, height: 24, borderRadius: 7, flex: 'none', marginTop: 1,
                    background: u.soft, color: u.color,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {blocked ? <Flame size={14} /> : <ClipboardCheck size={14} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span className={`pill ${u.pill}`} style={{ fontSize: 9.5, padding: '1px 6px' }}>{u.label}</span>
                    <span className="tabular" style={{ fontSize: 10.5, color: 'var(--fg-quaternary)', marginLeft: 'auto' }}>
                      {ageLabel(t.createdAt, nowMs)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: 'var(--fg-primary)' }}>{t.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  title="Dismiss (does not complete)"
                  aria-label="Dismiss"
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--fg-quaternary)', padding: 2, lineHeight: 0, flex: 'none' }}
                >
                  <X size={14} />
                </button>
              </div>

              {(t.sourceModule || t.entityName) && (
                <div style={{ paddingLeft: 33, marginTop: 6, fontSize: 11.5, color: 'var(--fg-tertiary)' }}>
                  {t.sourceModule}
                  {t.entityName ? ` · ${t.entityName}` : ''}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, paddingLeft: 33, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => resolve(t.id)}
                  className="btn btn-accept"
                  data-testid={`action-resolve-${t.id}`}
                  style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
                >
                  <ClipboardCheck size={12} /> Mark done
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/intelligence/inbox')}
                  className="btn btn-ghost"
                  style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
                >
                  <ArrowUpRight size={12} /> Open
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, color: 'var(--fg-quaternary)' }}>Highest-urgency open tasks</span>
        <button
          type="button"
          onClick={() => navigate('/intelligence/inbox')}
          className="btn btn-ghost"
          style={{ fontSize: 11.5, padding: '4px 8px' }}
        >
          View all
        </button>
      </div>
    </div>
  );
}

export default ActionCenter;
