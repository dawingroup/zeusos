/**
 * ModuleContentWrapper
 * Standard content wrapper for module layout outlets.
 * Provides consistent padding, overflow containment, and width control.
 */

import { cn } from '@/shared/lib/utils';

interface ModuleContentWrapperProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ModuleContentWrapper({
  children,
  className,
  noPadding = false,
}: ModuleContentWrapperProps) {
  return (
    <div
      className={cn(
        'flex-1 min-w-0',
        !noPadding && 'px-4 pt-6 pb-6',
        className
      )}
    >
      {children}
    </div>
  );
}
