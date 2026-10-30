/**
 * The rail's Actions segment: what needs this person now, worst first.
 * A body with no chrome of its own — the rail supplies header, sub line, footer.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ClipboardCheck, Flame, X } from 'lucide-react';

import { pushToast } from '@/shared/components/feedback';
import { describeCallableError } from '@/shared/utils/callableError';
import { ActionCenterFocusStrip } from '@/modules/intelligence-layer/daily-plan/components/ActionCenterFocusStrip';
import { URGENCY, ageLabel } from './config';
import { useActionQueue } from './useActionQueue';

export interface ActionCenterListProps {
  /** Called after a row navigates away (the rail closes itself in overlay mode). */
  onNavigate?: () => void;
}

export function ActionCenterList({ onNavigate }: ActionCenterListProps) {
  const navigate = useNavigate();
  const { visible, loading, leavingId, now, dismiss, resolve } = useActionQueue();

  const open = (taskId: string) => {
    navigate(`/intelligence/inbox?task=${encodeURIComponent(taskId)}`);
    onNavigate?.();
  };

  const done = async (taskId: string) => {
    try {
      await resolve(taskId);
    } catch (err) {
      pushToast(describeCallableError(err, 'mark the task done'), { tone: 'error' });
    }
  };

  return (
    <>
      <ActionCenterFocusStrip />
      {!loading && visible.length === 0 && (
        <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--fg-tertiary)' }}>
          Nothing needs you right now.
        </div>
      )}
      {visible.map(({ task: t, urgency }) => {
        const u = URGENCY[urgency];
        const isLeaving = leavingId === t.id;
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
                    {ageLabel(t.createdAt, now)}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: 'var(--fg-primary)' }}>{t.title}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                title="Dismiss (does not complete)"
                aria-label={`Dismiss: ${t.title}`}
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
                onClick={() => void done(t.id)}
                className="btn btn-accept"
                data-testid={`action-resolve-${t.id}`}
                style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
              >
                <ClipboardCheck size={12} /> Mark done
              </button>
              <button
                type="button"
                onClick={() => open(t.id)}
                className="btn btn-ghost"
                style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
              >
                <ArrowUpRight size={12} /> Open
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ActionCenterList;
