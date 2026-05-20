/**
 * BaseCard Component
 * Base card component with consistent styling following Finishes patterns
 */

import { cn } from '@/shared/lib/utils';

interface BaseCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function BaseCard({ children, className, padding = 'md' }: BaseCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200",
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
