/**
 * Status Badge - Displays status with appropriate colors
 */

import { ProjectStatus, PROJECT_STATUSES } from '../../types/project';
import { PaymentStatus, PAYMENT_STATUS_CONFIG } from '../../types/payment';

type StatusType = ProjectStatus | PaymentStatus | string;

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  type?: 'project' | 'payment' | 'custom';
  customColor?: string;
}

const STATUS_COLORS: Record<string, string> = {
  // Project statuses
  planning: 'bg-blue-100 text-blue-700',
  procurement: 'bg-purple-100 text-purple-700',
  mobilization: 'bg-indigo-100 text-indigo-700',
  active: 'bg-green-100 text-green-700',
  substantial_completion: 'bg-teal-100 text-teal-700',
  defects_liability: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-gray-100 text-gray-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  
  // Payment statuses
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  processing: 'bg-purple-100 text-purple-700',
  paid: 'bg-teal-100 text-teal-700',
  
  // Progress statuses
  ahead: 'bg-blue-100 text-blue-700',
  on_track: 'bg-green-100 text-green-700',
  slightly_behind: 'bg-yellow-100 text-yellow-700',
  significantly_behind: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  behind: 'bg-yellow-100 text-yellow-700',
  
  // Generic
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

function getStatusLabel(status: StatusType, type?: string): string {
  if (type === 'project' && status in PROJECT_STATUSES) {
    return PROJECT_STATUSES[status as ProjectStatus].label;
  }
  if (type === 'payment' && status in PAYMENT_STATUS_CONFIG) {
    return PAYMENT_STATUS_CONFIG[status as PaymentStatus].label;
  }
  
  // Default: Format status string
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBadge({ 
  status, 
  size = 'md', 
  type,
  customColor 
}: StatusBadgeProps) {
  const colorClass = customColor || STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  const sizeClass = SIZE_CLASSES[size];
  const label = getStatusLabel(status, type);

  return (
    <span 
      className={`inline-flex items-center font-medium rounded-full ${colorClass} ${sizeClass}`}
    >
      {label}
    </span>
  );
}
