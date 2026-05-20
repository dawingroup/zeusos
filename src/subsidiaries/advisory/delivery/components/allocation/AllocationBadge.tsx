/**
 * ALLOCATION BADGE
 *
 * Small inline badge showing that an accountability entry is part of
 * a multi-project allocation group. Links to the allocation group detail.
 */

import { GitBranch } from 'lucide-react';

interface AllocationBadgeProps {
  groupNumber: string;
  groupId?: string;
  orgId?: string;
  compact?: boolean;
}

export function AllocationBadge({ groupNumber, compact }: AllocationBadgeProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
        <GitBranch className="w-3 h-3" />
        Split
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
      <GitBranch className="w-3.5 h-3.5" />
      {groupNumber}
    </span>
  );
}
