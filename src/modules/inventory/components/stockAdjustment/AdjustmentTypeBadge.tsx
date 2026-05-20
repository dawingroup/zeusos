/**
 * AdjustmentTypeBadge
 * Icon + label for adjustment types.
 */

import {
  ArrowUpDown,
  AlertTriangle,
  MinusCircle,
  Factory,
  Package,
  Truck,
  Undo2,
  ArrowLeftRight,
  ClipboardCheck,
  Landmark,
  Repeat,
  Recycle,
} from 'lucide-react';
import { Badge } from '@/core/components/ui/badge';
import type { AdjustmentType } from '../../types/stockAdjustment';
import { ADJUSTMENT_TYPE_LABELS } from '../../types/stockAdjustment';

const TYPE_ICONS: Record<AdjustmentType, React.ReactNode> = {
  physical_count_variance: <ClipboardCheck className="h-3 w-3" />,
  damage_spoilage: <AlertTriangle className="h-3 w-3" />,
  shrinkage_loss: <MinusCircle className="h-3 w-3" />,
  production_consumption: <Factory className="h-3 w-3" />,
  production_output: <Package className="h-3 w-3" />,
  internal_transfer: <ArrowLeftRight className="h-3 w-3" />,
  opening_balance: <Landmark className="h-3 w-3" />,
  reclassification: <Repeat className="h-3 w-3" />,
  goods_received: <Truck className="h-3 w-3" />,
  customer_return: <Undo2 className="h-3 w-3" />,
  supplier_return: <ArrowUpDown className="h-3 w-3" />,
  offcut_adjustment: <Recycle className="h-3 w-3" />,
};

interface AdjustmentTypeBadgeProps {
  type: AdjustmentType;
}

export function AdjustmentTypeBadge({ type }: AdjustmentTypeBadgeProps) {
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      {TYPE_ICONS[type] || <ArrowUpDown className="h-3 w-3" />}
      {ADJUSTMENT_TYPE_LABELS[type] || type}
    </Badge>
  );
}
