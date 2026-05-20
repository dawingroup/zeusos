/**
 * DesignItemCOBadge — compact indicator rendered next to a design item
 * name showing which change order(s) have touched it (added, modified,
 * removed). Clicking navigates to the CO detail.
 *
 * When multiple COs touch the same item, we render a "3 COs" pill that
 * links to the most recent one by convention. Item cards that aren't
 * referenced by any CO render nothing (returns null).
 */

import { Link } from 'react-router-dom';
import { Plus, Pencil, Minus, Clock } from 'lucide-react';
import type {
  DesignItemCORef,
  DesignItemCOAction,
} from '../../services/changeOrderContextService';

interface Props {
  refs: DesignItemCORef[] | undefined;
  salesOrderId: string | null;
  compact?: boolean;
}

const ACTION_META: Record<
  DesignItemCOAction,
  { label: string; icon: typeof Plus; class: string }
> = {
  added: {
    label: 'Added',
    icon: Plus,
    class: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  modified: {
    label: 'Modified',
    icon: Pencil,
    class: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  removed: {
    label: 'Removed',
    icon: Minus,
    class: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export default function DesignItemCOBadge({ refs, salesOrderId, compact = false }: Props) {
  if (!refs || refs.length === 0) return null;

  // Prefer to display the most *impactful* ref (removed > modified > added),
  // but only the first match — list views show a single badge per row.
  const sorted = [...refs].sort((a, b) => priority(b) - priority(a));
  const top = sorted[0];
  const meta = ACTION_META[top.action];
  const Icon = meta.icon;
  const pending = top.coStatus !== 'approved' && top.coStatus !== 'rejected' && top.coStatus !== 'withdrawn';

  const href = salesOrderId
    ? `/sales-orders/${salesOrderId}/change-orders/${top.coId}`
    : '#';

  const label = compact
    ? `CO ${meta.label.charAt(0)}`
    : refs.length === 1
      ? `${meta.label} by ${top.coNumber}`
      : `${meta.label} · +${refs.length - 1} more`;

  return (
    <Link
      to={href}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${meta.class} hover:opacity-80`}
      title={refs
        .map((r) => `${r.coNumber}: ${r.action} (${r.coStatus})`)
        .join('\n')}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
      {pending && (
        <Clock className="h-2.5 w-2.5 opacity-70" aria-label="Pending approval" />
      )}
    </Link>
  );
}

function priority(ref: DesignItemCORef): number {
  // Removal carries the strongest signal; modifications next; additions last.
  const actionWeight =
    ref.action === 'removed' ? 3 : ref.action === 'modified' ? 2 : 1;
  // Un-applied (still-pending) refs sort above already-applied ones so the
  // UI spotlights "action needed" items.
  const statusWeight = ref.applied ? 0 : 1;
  return actionWeight * 10 + statusWeight;
}
