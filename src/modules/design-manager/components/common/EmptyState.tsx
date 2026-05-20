/**
 * Empty State Component
 * Reusable empty state display with action option
 */

import { cn } from '@/shared/lib/utils';
import { FolderOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ 
  icon,
  title = 'No items found',
  message = 'There are no items to display.',
  actionLabel,
  onAction,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || <FolderOpen className="w-6 h-6 text-gray-400" />}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 mb-4 max-w-md">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1d1d1f] text-white rounded-lg hover:bg-[#424245] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
