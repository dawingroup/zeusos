/**
 * MyTasksCard — dashboard widget surfacing the signed-in user's open
 * generated tasks (the intelligence-layer task inbox), so the AI task engine
 * is visible on the landing surface rather than buried under /intelligence.
 *
 * Reuses `useEmployeeTaskInbox` (resolves the caller's employee doc + the
 * realtime `generatedTasks` subscription) and shows the top open tasks with a
 * priority chip + due date, deep-linking to the full inbox at
 * `/intelligence/inbox`.
 */

import { Link } from 'react-router-dom';
import { ClipboardList, ArrowUpRight } from 'lucide-react';
import { useEmployeeTaskInbox, type EmployeeTask } from '@/modules/intelligence-layer/hooks/useEmployeeTaskInbox';

const PRIORITY_TONE: Record<EmployeeTask['priority'], { bg: string; fg: string }> = {
  P0: { bg: 'var(--rag-red-soft)', fg: 'var(--rag-red)' },
  P1: { bg: 'var(--rag-red-soft)', fg: 'var(--rag-red)' },
  P2: { bg: 'var(--rag-amber-soft)', fg: 'var(--rag-amber)' },
  P3: { bg: 'var(--bg-sunken)', fg: 'var(--fg-tertiary)' },
};

function dueLabel(due?: Date): { text: string; overdue: boolean } {
  if (!due) return { text: 'No due date', overdue: false };
  const now = Date.now();
  const ms = due.getTime();
  const overdue = ms < now;
  const text = due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return { text: overdue ? `Overdue · ${text}` : `Due ${text}`, overdue };
}

const OPEN_STATUSES: EmployeeTask['status'][] = ['pending', 'in_progress'];

export function MyTasksCard({ limit = 5 }: { limit?: number }) {
  const { tasks, loading } = useEmployeeTaskInbox();

  const open = tasks
    .filter((t) => OPEN_STATUSES.includes(t.status))
    .sort((a, b) => {
      // Soonest-due first; tasks without a due date sink to the bottom.
      const av = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;
      const bv = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;
      return av - bv;
    });

  const shown = open.slice(0, limit);

  return (
    <div className="card">
      <div className="card-head">
        <h3>My tasks</h3>
        <Link to="/intelligence/inbox" className="sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {open.length > 0 ? `${open.length} open` : 'Inbox'} <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && shown.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', padding: '4px 0' }}>Loading your tasks…</div>
        )}

        {!loading && shown.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={15} style={{ color: 'var(--fg-tertiary)', flex: 'none' }} />
            No open tasks. The AI task engine assigns work here as events fire.
          </div>
        )}

        {shown.map((t) => {
          const tone = PRIORITY_TONE[t.priority] ?? PRIORITY_TONE.P3;
          const due = dueLabel(t.dueDate);
          return (
            <Link
              key={t.id}
              to="/intelligence/inbox"
              style={{ padding: 10, borderRadius: 8, background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span
                className="tabular"
                style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: tone.bg, color: tone.fg, flex: 'none' }}
              >
                {t.priority}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                  {t.entityName ? `${t.entityName} · ` : ''}{t.sourceModule}
                </div>
              </div>
              <span style={{ fontSize: 11, color: due.overdue ? 'var(--rag-red)' : 'var(--fg-tertiary)', flex: 'none', fontWeight: due.overdue ? 600 : 400 }}>
                {due.text}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default MyTasksCard;
