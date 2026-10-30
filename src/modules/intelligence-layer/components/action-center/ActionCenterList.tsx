/**
 * The rail's Actions segment: what needs this person now, worst first.
 * A body with no chrome of its own — the rail supplies header, sub line, footer.
 * The card opens the record that needs the action; Mark done appears only where
 * one click may close it, because an approval is decided on its record.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ClipboardCheck, Flag, Flame, RotateCcw, X, type LucideIcon } from 'lucide-react';

import { pushToast } from '@/shared/components/feedback';
import { describeCallableError } from '@/shared/utils/callableError';
import { ActionCenterFocusStrip } from '@/modules/intelligence-layer/daily-plan/components/ActionCenterFocusStrip';
import { URGENCY, type ActionItem, type ActionType } from './config';
import { useActionQueue } from './useActionQueue';

const TYPE_ICON: Record<ActionType, LucideIcon> = { approval: Check, directive: ClipboardCheck, blocker: Flame };

export interface ActionCenterListProps {
  /** Called after a card navigates away (the rail closes itself in overlay mode). */
  onNavigate?: () => void;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function ActionCenterList({ onNavigate }: ActionCenterListProps) {
  const navigate = useNavigate();
  const { visible, loading, leavingId, dismissedCount, dismiss, resolve, restoreAll } = useActionQueue();

  const open = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  const done = async (item: ActionItem) => {
    try {
      await resolve(item);
    } catch (err) {
      pushToast(describeCallableError(err, 'mark the task done'), { tone: 'error' });
    }
  };

  return (
    <>
      <ActionCenterFocusStrip />
      {!loading && visible.length === 0 && (
        <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--fg-tertiary)' }}>
          <Flag size={18} style={{ margin: '0 auto 8px', color: 'var(--rag-green)' }} aria-hidden="true" />
          You're all caught up.
          {dismissedCount > 0 && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="rail-foot-btn" onClick={restoreAll}>
                <RotateCcw size={11} aria-hidden="true" /> Restore {dismissedCount} dismissed
              </button>
            </div>
          )}
        </div>
      )}
      {visible.map((it) => {
        const u = URGENCY[it.urgency];
        const Glyph = TYPE_ICON[it.type];
        const isLeaving = leavingId === it.id;
        return (
          <div
            key={it.id}
            data-testid={`action-item-${it.id}`}
            role="button"
            tabIndex={0}
            aria-label={`${it.title} — open`}
            onClick={() => open(it.go)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                open(it.go);
              }
            }}
            style={{
              position: 'relative', padding: '11px 13px 12px 15px', borderRadius: 10, cursor: 'pointer',
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
                <Glyph size={14} aria-hidden="true" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span className={`pill ${u.pill}`} style={{ fontSize: 9.5, padding: '1px 6px' }}>{u.label}</span>
                  <span className="tabular" style={{ fontSize: 10.5, color: 'var(--fg-quaternary)', marginLeft: 'auto' }}>{it.age}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: 'var(--fg-primary)' }}>{it.title}</div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  dismiss(it.id);
                }}
                title="Dismiss (does not complete)"
                aria-label={`Dismiss: ${it.title}`}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--fg-quaternary)', padding: 2, lineHeight: 0, flex: 'none' }}
              >
                <X size={14} />
              </button>
            </div>

            {it.context && (
              <div style={{ paddingLeft: 33, marginTop: 6, fontSize: 11.5, color: 'var(--fg-tertiary)' }}>{it.context}</div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, paddingLeft: 33, flexWrap: 'wrap' }}>
              {it.completeTaskId && (
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    void done(it);
                  }}
                  className="btn btn-accept"
                  data-testid={`action-resolve-${it.id}`}
                  style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
                >
                  <ClipboardCheck size={12} /> Mark done
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  open(it.go);
                }}
                className="btn btn-ghost"
                style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
              >
                <ArrowUpRight size={12} /> {it.goLabel}
              </button>
              {it.contextGo && (
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    open(it.contextGo as string);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 7 }}
                >
                  Read context
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ActionCenterList;
