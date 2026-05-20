/**
 * StatusCard Component
 * Card with colored left border indicating status
 * Follows Finishes Design Manager pattern
 */

import { cn } from '@/shared/lib/utils';

export type StatusCardColor = 'primary' | 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'indigo' | 'gray';

interface StatusCardProps {
  children: React.ReactNode;
  color: StatusCardColor;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const colorClasses: Record<StatusCardColor, string> = {
  primary: 'border-l-primary',
  blue: 'border-l-blue-500',
  amber: 'border-l-amber-500',
  green: 'border-l-green-500',
  red: 'border-l-red-500',
  purple: 'border-l-purple-500',
  indigo: 'border-l-indigo-500',
  gray: 'border-l-gray-400',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function StatusCard({ children, color, className, padding = 'md' }: StatusCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200 border-l-4",
        colorClasses[color],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
