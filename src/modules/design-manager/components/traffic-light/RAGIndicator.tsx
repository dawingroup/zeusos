/**
 * RAG Indicator Component
 * Visual traffic light indicator for RAG status
 */

import { cn } from '@/shared/lib/utils';
import type { RAGStatusValue } from '../../types';
import { RAG_BG_COLORS, RAG_LABELS } from '../../utils/formatting';

export interface RAGIndicatorProps {
  status: RAGStatusValue;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  pulse?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  xs: 'w-2 h-2',
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
};

export function RAGIndicator({ 
  status, 
  size = 'md', 
  pulse = false,
  showLabel = false,
  onClick,
  className 
}: RAGIndicatorProps) {
  const indicator = (
    <div
      className={cn(
        'rounded-full flex-shrink-0',
        sizeClasses[size],
        RAG_BG_COLORS[status],
        pulse && status === 'red' && 'animate-pulse',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={RAG_LABELS[status]}
      title={RAG_LABELS[status]}
    />
  );

  if (showLabel) {
    return (
      <div className="flex items-center gap-2">
        {indicator}
        <span className="text-sm text-gray-600">{RAG_LABELS[status]}</span>
      </div>
    );
  }

  return indicator;
}

export default RAGIndicator;
