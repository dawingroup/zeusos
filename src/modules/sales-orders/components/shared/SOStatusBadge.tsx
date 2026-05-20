/**
 * SOStatusBadge — Colored status badge for sales order statuses.
 */

import type { SalesOrderStatus } from '../../types';
import { SO_STATUS_LABELS, SO_STATUS_COLORS } from '../../constants';

interface SOStatusBadgeProps {
  status: SalesOrderStatus;
  size?: 'small' | 'medium';
}

export default function SOStatusBadge({ status, size = 'small' }: SOStatusBadgeProps) {
  const colors = SO_STATUS_COLORS[status];
  const label = SO_STATUS_LABELS[status];
  const sizeClass = size === 'small' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeClass}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}
