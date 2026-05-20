/**
 * OrderKanbanCard — Compact MO card for kanban columns.
 * Migrated off MUI to design-system tokens.
 */

import React from 'react';
import { Clock, User } from 'lucide-react';
import type { ManufacturingOrderMES } from '../../types';
import { WORKSTATION_TYPE_LABELS } from '../../types';
import { RagBadge } from '@/shared/components/data-display';

interface OrderKanbanCardProps {
  order: ManufacturingOrderMES;
  onClick?: (order: ManufacturingOrderMES) => void;
}

const PRIORITY_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  low: 'na',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

export const OrderKanbanCard: React.FC<OrderKanbanCardProps> = ({ order, onClick }) => {
  const progress =
    order.totalSteps > 0
      ? Math.round((order.completedSteps / order.totalSteps) * 100)
      : 0;

  const dueDate = order.dueDate
    ? typeof order.dueDate === 'object' && 'toDate' in order.dueDate
      ? (order.dueDate as { toDate: () => Date }).toDate()
      : null
    : null;

  const isOverdue = dueDate ? dueDate < new Date() : false;

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(order) : undefined}
      className="text-left rounded-[10px] border transition-shadow hover:shadow-[var(--shadow-md)]"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        padding: 12,
        cursor: onClick ? 'grab' : 'default',
        borderLeft: `3px solid ${
          isOverdue
            ? 'var(--rag-red)'
            : order.priority === 'urgent'
            ? 'var(--rag-red)'
            : order.priority === 'high'
            ? 'var(--rag-amber)'
            : order.priority === 'medium'
            ? 'var(--rag-blue)'
            : 'var(--border-strong)'
        }`,
      }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className="text-[13px] font-semibold font-mono truncate"
          style={{ color: 'var(--fg-primary)' }}
        >
          {order.moNumber}
        </span>
        <RagBadge tone={PRIORITY_TONE[order.priority] ?? 'na'}>
          {order.priority}
        </RagBadge>
      </div>

      {/* Design item name */}
      <div
        className="text-[12px] truncate mb-1.5"
        style={{ color: 'var(--fg-secondary)' }}
      >
        {order.designItemName}
      </div>

      {/* Customer */}
      {order.customerName && (
        <div
          className="flex items-center gap-1 text-[11px] mb-1"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          <User className="h-3 w-3" />
          <span className="truncate">{order.customerName}</span>
        </div>
      )}

      {/* Due date */}
      {dueDate && (
        <div
          className="flex items-center gap-1 text-[11px] mb-2"
          style={{
            color: isOverdue ? 'var(--rag-red)' : 'var(--fg-tertiary)',
          }}
        >
          <Clock className="h-3 w-3" />
          <span>{dueDate.toLocaleDateString()}</span>
        </div>
      )}

      {/* Progress */}
      {order.totalSteps > 0 && (
        <div className="mt-2">
          <div
            className="flex items-center justify-between text-[10.5px] mb-1 tabular-nums"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            <span>
              {order.completedSteps}/{order.totalSteps} steps
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-sunken)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor:
                  progress >= 100
                    ? 'var(--rag-green)'
                    : progress > 0
                    ? 'var(--accent)'
                    : 'var(--border-default)',
              }}
            />
          </div>
        </div>
      )}

      {/* Current workstation */}
      {order.currentWorkstationId && (
        <div
          className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px]"
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border-default)',
            color: 'var(--fg-secondary)',
          }}
        >
          {WORKSTATION_TYPE_LABELS[
            order.currentWorkstationId as keyof typeof WORKSTATION_TYPE_LABELS
          ] ?? 'Workstation'}
        </div>
      )}
    </button>
  );
};
