/**
 * Context rail — the shell's single right rail (ported from DawinOS).
 *
 * Replaces the floating corner surfaces with one collapsible column. Push mode
 * at >=1440px viewport (the canvas gives up a 340px margin, the way it gives
 * one to the sidebar); overlay below that (it slides over the canvas, and closes
 * on canvas click or Esc). Open state and the last segment persist (railStore).
 * The rail is chrome, not a card: no radius, no card shadow.
 *
 * Closed means unmounted: no segment body runs while the rail is shut.
 */

import { useEffect } from 'react';
import { Bell, ChevronRight, Sparkles, type LucideIcon } from 'lucide-react';

import { ActionCenterList, useActionQueue } from '@/modules/intelligence-layer/components/action-center';
import { AIAssistantPanel } from '@/modules/intelligence-layer/components/assistant/AIAssistantPanel';
import { useRailStore, type RailSeg } from '@/shared/stores/railStore';
import type { RailMode } from './useRailMode';
import './context-rail.css';

const RAIL_SEGS: { id: RailSeg; label: string; icon: LucideIcon }[] = [
  { id: 'actions', label: 'Actions', icon: Bell },
  { id: 'ask', label: 'Ask', icon: Sparkles },
];

export interface ContextRailProps {
  mode: RailMode;
  /** Page grounding the assistant sends with each turn. */
  assistantContext?: Record<string, unknown>;
}

export function ContextRail({ mode, assistantContext }: ContextRailProps) {
  const open = useRailStore((s) => s.open);
  const seg = useRailStore((s) => s.seg);
  const setSeg = useRailStore((s) => s.setSeg);
  const setOpen = useRailStore((s) => s.setOpen);
  const askContext = useRailStore((s) => s.askContext);

  const queue = useActionQueue();
  const activeSeg: RailSeg = RAIL_SEGS.some((s) => s.id === seg) ? seg : 'actions';

  useEffect(() => {
    if (!open || mode !== 'overlay') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, setOpen]);

  if (!open) return null;

  const close = () => setOpen(false);
  const closeIfOverlay = () => {
    if (mode === 'overlay') setOpen(false);
  };

  const counts: Partial<Record<RailSeg, number>> = { actions: queue.visible.length };

  return (
    <aside className="context-rail" data-mode={mode} role="complementary" aria-label="Context rail" data-testid="context-rail">
      <div className="rail-head">
        <div className="rail-segs" role="tablist" aria-label="Rail sections">
          {RAIL_SEGS.map((s) => {
            const c = counts[s.id] ?? 0;
            const active = activeSeg === s.id;
            const Glyph = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={c > 0 ? `${s.label} — ${c}` : s.label}
                className={`rail-seg ${active ? 'active' : ''}`}
                onClick={() => setSeg(s.id)}
                title={s.label}
              >
                <Glyph size={12} aria-hidden="true" />
                <span>{s.label}</span>
                {c > 0 && (
                  <em className={s.id === 'actions' && queue.blockingCount > 0 ? 'hot' : ''}>{c > 99 ? '99+' : c}</em>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" className="rail-close" onClick={close} title="Collapse rail  ( ] )" aria-label="Collapse rail">
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      {activeSeg === 'actions' && (
        <>
          <div className="rail-sub">
            {queue.visible.length
              ? `${queue.visible.length} need you${queue.blockingCount ? ` · ${queue.blockingCount} blocking` : ''}`
              : queue.loading
                ? 'Checking…'
                : 'Nothing pending'}
          </div>
          <div className="rail-body rail-actions">
            <ActionCenterList onNavigate={closeIfOverlay} />
          </div>
          {queue.visible.length > 0 && (
            <div className="rail-foot">
              <span>Persists until actioned</span>
              <button type="button" onClick={queue.clearAll} className="rail-foot-btn">
                Clear all
              </button>
            </div>
          )}
        </>
      )}

      {activeSeg === 'ask' && (
        <div className="rail-body rail-ask">
          <AIAssistantPanel
            open
            variant="rail"
            onClose={close}
            context={askContext ? { ...assistantContext, ...askContext } : assistantContext}
          />
        </div>
      )}
    </aside>
  );
}

export default ContextRail;
