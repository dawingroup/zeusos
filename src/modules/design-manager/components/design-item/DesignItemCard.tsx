/**
 * Design Item Card Component
 * Compact card for grid/list views
 */

import { cn } from '@/shared/lib/utils';
import type { DesignItem } from '../../types';
import { RAGIndicator } from '../traffic-light/RAGIndicator';
import { StageBadge } from './StageBadge';
import { ReadinessGauge } from './ReadinessGauge';
import { CATEGORY_LABELS, formatRelativeTime } from '../../utils/formatting';
import { getWorstStatus, countByStatus } from '../../utils/rag-calculations';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

export interface DesignItemCardProps {
  item: DesignItem;
  onClick?: (item: DesignItem) => void;
  selected?: boolean;
  compact?: boolean;
  className?: string;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

const FINAL_RELEASE_STAGES = new Set([
  'production-ready',
  'procure-received',
  'arch-approved',
  'const-complete',
]);

export function DesignItemCard({ 
  item, 
  onClick, 
  selected = false,
  compact = false,
  className 
}: DesignItemCardProps) {
  const worstStatus = getWorstStatus(item.ragStatus);
  const statusCounts = countByStatus(item.ragStatus);
  
  const isOverdue = item.dueDate && 
    item.dueDate.seconds * 1000 < Date.now() && 
    !FINAL_RELEASE_STAGES.has(item.currentStage);

  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-4 transition-all',
        selected ? 'border-[#872E5C] ring-1 ring-[#872E5C]' : 'border-gray-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300',
        className
      )}
      onClick={() => onClick?.(item)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
          <p className="text-xs text-gray-500">{item.itemCode}</p>
        </div>
        <ReadinessGauge value={item.overallReadiness} size="sm" />
      </div>

      {/* Category & Stage */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {CATEGORY_LABELS[item.category]}
        </span>
        <StageBadge stage={item.currentStage} size="sm" />
      </div>

      {/* RAG Summary */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <RAGIndicator status={worstStatus} size="sm" pulse={worstStatus === 'red'} />
          <span className="text-xs text-gray-600">
            {statusCounts.green || 0}
            <span className="text-green-600">✓</span>
            {' '}
            {statusCounts.amber || 0}
            <span className="text-amber-500">●</span>
            {' '}
            {statusCounts.red || 0}
            <span className="text-red-500">●</span>
          </span>
        </div>
      </div>

      {/* Footer */}
      {!compact && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* Priority */}
            {item.priority && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                priorityColors[item.priority]
              )}>
                {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
              </span>
            )}
            
            {/* Due date */}
            {item.dueDate && (
              <div className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-red-600' : 'text-gray-500'
              )}>
                {isOverdue ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                <span>
                  {new Date(item.dueDate.seconds * 1000).toLocaleDateString('en-ZA', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Updated time */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(item.updatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DesignItemCard;
