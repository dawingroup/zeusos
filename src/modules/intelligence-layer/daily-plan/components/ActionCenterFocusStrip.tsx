/**
 * ActionCenterFocusStrip — the plan's one line inside the Action Center.
 *
 * The Action Center lists what needs a person now; this says how today's
 * CONTRACT is going (3/7 done, the day goal) and, from 16:30, that the
 * wrap-up is due. One click opens /tasks/today. Renders nothing without a
 * plan, so it never adds chrome to an empty day.
 */

import { useNavigate } from 'react-router-dom';
import { Clock, Target } from 'lucide-react';

import { useMyTasks } from '../../context/MyTasksContext';
import { isWrapUpDue } from '../format';

export function ActionCenterFocusStrip({ nowMs = Date.now() }: { nowMs?: number }) {
  const navigate = useNavigate();
  const { today } = useMyTasks();
  if (!today || today.loading || !today.hasPlan || !today.plan) return null;
  const { plan, doneCount, total, reviewed } = today;
  const due = isWrapUpDue(plan, nowMs);
  return (
    <button
      type="button"
      onClick={() => navigate('/tasks/today')}
      data-testid="action-center-focus-strip"
      className="w-full text-left border-0 cursor-pointer"
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px',
        background: due ? 'var(--rag-amber-soft)' : 'var(--bg-app)',
        borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-primary)', font: 'inherit',
      }}
    >
      {due ? <Clock size={14} style={{ color: 'var(--rag-amber)' }} /> : <Target size={14} style={{ color: 'var(--accent)' }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>
          {due ? 'Wrap up your day' : 'Your focus today'} · {doneCount}/{total} done
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plan.dayGoal || (reviewed ? `Reviewed by ${plan.reviewedByName || 'your manager'}` : 'Auto-generated · not yet reviewed')}
        </span>
      </span>
    </button>
  );
}

export default ActionCenterFocusStrip;
