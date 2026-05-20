/**
 * AdjustmentStatusBadge
 * Color-coded status badge for stock adjustments.
 */

import { Badge } from '@/core/components/ui/badge';
import type { AdjustmentStatus } from '../../types/stockAdjustment';
import { ADJUSTMENT_STATUS_LABELS } from '../../types/stockAdjustment';

const STATUS_STYLES: Record<AdjustmentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  submitted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface AdjustmentStatusBadgeProps {
  status: AdjustmentStatus;
}

export function AdjustmentStatusBadge({ status }: AdjustmentStatusBadgeProps) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] || STATUS_STYLES.draft}>
      {ADJUSTMENT_STATUS_LABELS[status] || status}
    </Badge>
  );
}
