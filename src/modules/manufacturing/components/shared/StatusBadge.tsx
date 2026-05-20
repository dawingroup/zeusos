/**
 * Reusable Status Badge Component
 * Provides consistent status badge styling across the manufacturing module
 */

import type { ManufacturingOrderStatus, MOStage } from '../../types';
import type { PurchaseOrderStatus } from '@/modules/procurement/types/purchaseOrder';
import type { ProcurementRequirementStatus } from '@/modules/procurement/types/procurement';
import { MO_STATUS_LABELS, MO_STAGE_LABELS } from '../../types';
import { PO_STATUS_LABELS } from '@/modules/procurement/types/purchaseOrder';
import { PROCUREMENT_STATUS_LABELS } from '@/modules/procurement/types/procurement';

// Color configurations
const MO_STATUS_CONFIG: Record<ManufacturingOrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  'pending-approval': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'in-progress': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'on-hold': { bg: 'bg-red-100', text: 'text-red-700' },
  'partially-complete': { bg: 'bg-teal-100', text: 'text-teal-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  'closed-out': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const MO_STAGE_CONFIG: Record<MOStage, { bg: string; text: string }> = {
  queued: { bg: 'bg-gray-100', text: 'text-gray-700' },
  cutting: { bg: 'bg-blue-100', text: 'text-blue-700' },
  assembly: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  finishing: { bg: 'bg-purple-100', text: 'text-purple-700' },
  qc: { bg: 'bg-amber-100', text: 'text-amber-700' },
  ready: { bg: 'bg-green-100', text: 'text-green-700' },
};

const PO_STATUS_CONFIG: Record<PurchaseOrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  'pending-approval': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  sent: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'partially-received': { bg: 'bg-amber-100', text: 'text-amber-700' },
  received: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const PROCUREMENT_STATUS_CONFIG: Record<ProcurementRequirementStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'added-to-po': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  ordered: { bg: 'bg-blue-100', text: 'text-blue-700' },
  received: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const PRIORITY_CONFIG = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
};

const RESERVATION_STATUS_CONFIG = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  consumed: { bg: 'bg-gray-100', text: 'text-gray-600' },
  released: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

type BadgeSize = 'sm' | 'md';

interface BaseBadgeProps {
  size?: BadgeSize;
  className?: string;
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

// Manufacturing Order Status Badge
interface MOStatusBadgeProps extends BaseBadgeProps {
  status: ManufacturingOrderStatus;
}

export function MOStatusBadge({ status, size = 'sm', className = '' }: MOStatusBadgeProps) {
  const config = MO_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {MO_STATUS_LABELS[status]}
    </span>
  );
}

// Manufacturing Order Stage Badge
interface MOStageBadgeProps extends BaseBadgeProps {
  stage: MOStage;
}

export function MOStageBadge({ stage, size = 'sm', className = '' }: MOStageBadgeProps) {
  const config = MO_STAGE_CONFIG[stage];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {MO_STAGE_LABELS[stage]}
    </span>
  );
}

// Purchase Order Status Badge
interface POStatusBadgeProps extends BaseBadgeProps {
  status: PurchaseOrderStatus;
}

export function POStatusBadge({ status, size = 'sm', className = '' }: POStatusBadgeProps) {
  const config = PO_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {PO_STATUS_LABELS[status]}
    </span>
  );
}

// Procurement Requirement Status Badge
interface ProcurementStatusBadgeProps extends BaseBadgeProps {
  status: ProcurementRequirementStatus;
}

export function ProcurementStatusBadge({ status, size = 'sm', className = '' }: ProcurementStatusBadgeProps) {
  const config = PROCUREMENT_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {PROCUREMENT_STATUS_LABELS[status]}
    </span>
  );
}

// Priority Badge
interface PriorityBadgeProps extends BaseBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export function PriorityBadge({ priority, size = 'sm', className = '' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

// Material Reservation Status Badge
interface ReservationStatusBadgeProps extends BaseBadgeProps {
  status: 'active' | 'consumed' | 'released';
}

export function ReservationStatusBadge({ status, size = 'sm', className = '' }: ReservationStatusBadgeProps) {
  const config = RESERVATION_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {status}
    </span>
  );
}

// Generic Status Badge (for custom statuses)
interface GenericStatusBadgeProps extends BaseBadgeProps {
  label: string;
  variant?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'indigo' | 'amber' | 'purple';
}

const VARIANT_CONFIG = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  red: { bg: 'bg-red-100', text: 'text-red-700' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export function StatusBadge({ label, variant = 'gray', size = 'sm', className = '' }: GenericStatusBadgeProps) {
  const config = VARIANT_CONFIG[variant];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {label}
    </span>
  );
}

// Export configs for external use if needed
export {
  MO_STATUS_CONFIG,
  MO_STAGE_CONFIG,
  PO_STATUS_CONFIG,
  PROCUREMENT_STATUS_CONFIG,
  PRIORITY_CONFIG,
  RESERVATION_STATUS_CONFIG,
  VARIANT_CONFIG,
};
