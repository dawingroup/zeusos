/**
 * The top bar's one door to the context rail: one icon, one count (actions that
 * need you + unread messages), and a label that says the worst of it.
 */

import { PanelRight } from 'lucide-react';
import { useActionQueue } from '@/modules/intelligence-layer/components/action-center';
import { useRailStore } from '@/shared/stores/railStore';
import './context-rail.css';

export interface RailTriggerProps {
  /** Unread conversations across WhatsApp and Team Chat. */
  unread: number;
}

export function RailTrigger({ unread }: RailTriggerProps) {
  const open = useRailStore((s) => s.open);
  const toggle = useRailStore((s) => s.toggle);
  const { visible, blockingCount } = useActionQueue();
  const n = visible.length + unread;

  const label = blockingCount > 0 ? `${blockingCount} blocking` : n > 0 ? `${n} need you` : 'All clear';
  const hint = open ? 'Collapse rail  ( ] )' : 'Open rail  ( ] )';

  return (
    <button
      type="button"
      className={`rail-trigger ${open ? 'open' : ''}`}
      onClick={toggle}
      title={hint}
      aria-label={`${hint} — ${label}`}
      aria-pressed={open}
      data-blocking={blockingCount > 0 ? 'true' : 'false'}
      data-testid="rail-trigger"
    >
      <PanelRight size={15} aria-hidden="true" />
      <span className="rail-trigger-label">{label}</span>
      {n > 0 && <em>{n > 99 ? '99+' : n}</em>}
    </button>
  );
}

export default RailTrigger;
