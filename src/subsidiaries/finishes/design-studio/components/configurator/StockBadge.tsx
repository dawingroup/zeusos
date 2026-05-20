/**
 * StockBadge — Green/amber/red availability indicator
 */
import type { StockStatus } from '../../types/constraintEngine.types';

interface StockBadgeProps {
  status: StockStatus;
}

const STATUS_CONFIG = {
  sufficient: { label: 'In Stock', color: 'bg-green-100 text-green-800' },
  in_stock: { label: 'In Stock', color: 'bg-green-100 text-green-800' },
  low_stock: { label: 'Low Stock', color: 'bg-amber-100 text-amber-800' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-800' },
} as const;

export function StockBadge({ status }: StockBadgeProps) {
  const config = STATUS_CONFIG[status.status] ?? STATUS_CONFIG.out_of_stock;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      title={`${status.inventoryItemName}: ${status.availableQuantity} available, ${status.requiredQuantity} required`}
    >
      {config.label}
      {status.estimatedRestockDays != null && status.status !== 'sufficient' && (
        <span className="ml-1 opacity-75">({status.estimatedRestockDays}d)</span>
      )}
    </span>
  );
}
