/**
 * MOCascadeBadge — compact pill shown next to the MO number indicating
 * that this MO was spawned from a change order (or is a parent that
 * has CO-spawned children). Clicking the "CO" pill links to the CO
 * detail page; clicking "Parent" links to the parent MO.
 */

import { Link } from 'react-router-dom';
import { GitMerge, GitBranch, FilePlus } from 'lucide-react';
import type { ManufacturingOrder } from '../../types';

interface Props {
  mo: ManufacturingOrder;
  parentMO?: ManufacturingOrder | null;
  childCount?: number;
  /** When provided, "CO" chip links to this SO's CO detail page. */
  salesOrderId?: string | null;
}

export default function MOCascadeBadge({
  mo,
  parentMO,
  childCount = 0,
  salesOrderId,
}: Props) {
  const chips: React.ReactNode[] = [];

  if (mo.originChangeOrderId) {
    const href = salesOrderId
      ? `/sales-orders/${salesOrderId}/change-orders/${mo.originChangeOrderId}`
      : '#';
    chips.push(
      <Link
        key="origin-co"
        to={href}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 hover:opacity-80"
        title="Spawned by change order"
      >
        <FilePlus className="h-2.5 w-2.5" />
        From CO
      </Link>,
    );
  }

  if (parentMO) {
    chips.push(
      <Link
        key="parent"
        to={`/manufacturing/orders/${parentMO.id}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:opacity-80"
        title={`Child of ${parentMO.moNumber}`}
      >
        <GitBranch className="h-2.5 w-2.5" />
        Child of {parentMO.moNumber}
      </Link>,
    );
  } else if (mo.parentMOId) {
    chips.push(
      <span
        key="parent-ref"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
        title={`Child of MO ${mo.parentMOId}`}
      >
        <GitBranch className="h-2.5 w-2.5" />
        Child MO
      </span>,
    );
  }

  if (childCount > 0) {
    chips.push(
      <span
        key="children"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
        title={`${childCount} CO-spawned child MO${childCount > 1 ? 's' : ''}`}
      >
        <GitMerge className="h-2.5 w-2.5" />
        {childCount} child{childCount > 1 ? 'ren' : ''}
      </span>,
    );
  }

  if (chips.length === 0) return null;

  return <span className="inline-flex items-center gap-1 flex-wrap">{chips}</span>;
}
