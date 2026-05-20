/**
 * Loading State Component
 * Reusable loading spinner with optional message
 */

import { cn } from '@/shared/lib/utils';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingState({ 
  message = 'Loading...',
  size = 'md',
  className 
}: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div 
        className={cn(
          'animate-spin rounded-full border-b-2 border-[#1d1d1f]',
          sizeClasses[size]
        )} 
      />
      {message && (
        <p className="text-gray-500 mt-4 text-sm">{message}</p>
      )}
    </div>
  );
}

export default LoadingState;
