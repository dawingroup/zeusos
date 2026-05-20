/**
 * EFRIS Validation Badge Component
 * Visual indicator for EFRIS invoice validation status
 */

import React from 'react';
import { Badge } from '@/core/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
  Ban,
} from 'lucide-react';
import { EFRISInvoiceStatus } from '../../types/efris';
import { cn } from '@/shared/lib/utils';

interface EFRISValidationBadgeProps {
  status: EFRISInvoiceStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<EFRISInvoiceStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
  description: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    description: 'Invoice not yet validated with EFRIS',
  },
  valid: {
    label: 'Valid',
    icon: CheckCircle2,
    variant: 'default',
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Invoice validated successfully with URA',
  },
  invalid: {
    label: 'Invalid',
    icon: XCircle,
    variant: 'destructive',
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Invoice failed EFRIS validation',
  },
  expired: {
    label: 'Expired',
    icon: AlertTriangle,
    variant: 'destructive',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    description: 'Fiscal document has expired',
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    variant: 'destructive',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    description: 'Invoice was cancelled in EFRIS',
  },
  not_found: {
    label: 'Not Found',
    icon: HelpCircle,
    variant: 'outline',
    color: 'text-gray-500 bg-gray-50 border-gray-200',
    description: 'FDN not found in EFRIS system',
  },
};

const sizeConfig = {
  sm: { badge: 'text-xs px-1.5 py-0.5', icon: 'h-3 w-3' },
  md: { badge: 'text-sm px-2 py-1', icon: 'h-4 w-4' },
  lg: { badge: 'text-base px-3 py-1.5', icon: 'h-5 w-5' },
};

export function EFRISValidationBadge({
  status,
  showLabel = true,
  size = 'md',
  className,
}: EFRISValidationBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;
  
  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1 border',
        config.color,
        sizeStyles.badge,
        className
      )}
      title={config.description}
    >
      <Icon className={sizeStyles.icon} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

export default EFRISValidationBadge;
