/**
 * OrderKanbanView — Kanban board showing MOs grouped by MES status.
 * Migrated off MUI to the shared <KanbanColumn> primitive + design tokens.
 */

import React from 'react';
import type { ManufacturingOrderMES } from '../../types';
import { MO_STATUS_MAP } from '../../types';
import { OrderKanbanCard } from './OrderKanbanCard';
import type { MOProjectSalesOrderGroup } from '../../utils/moGrouping';
import { KanbanColumn } from '@/shared/components/data-display';

interface OrderKanbanViewProps {
  ordersByStatus: Record<string, ManufacturingOrderMES[]>;
  groupedByStatus: Record<string, MOProjectSalesOrderGroup<ManufacturingOrderMES>[]>;
  onOrderClick: (order: ManufacturingOrderMES) => void;
}

const COLUMN_ORDER = [
  'draft',
  'planned',
  'ready',
  'in_progress',
  'on_hold',
  'quality_review',
  'completed',
];

const COLUMN_STRIPE: Record<string, string> = {
  draft: 'var(--border-strong)',
  planned: 'var(--rag-blue)',
  ready: 'var(--rag-green)',
  in_progress: 'var(--golden-bell)',
  on_hold: 'var(--rag-red)',
  quality_review: 'var(--boysenberry)',
  completed: 'var(--rag-green)',
};

export const OrderKanbanView: React.FC<OrderKanbanViewProps> = ({
  ordersByStatus,
  groupedByStatus,
  onOrderClick,
}) => {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4"
      style={{ minHeight: 400 }}
    >
      {COLUMN_ORDER.map((status) => {
        const orders = ordersByStatus[status] ?? [];
        const groupedOrders = groupedByStatus[status] ?? [];
        const label = MO_STATUS_MAP[status as keyof typeof MO_STATUS_MAP] ?? status;
        const stripe = COLUMN_STRIPE[status] ?? 'var(--border-strong)';

        return (
          <KanbanColumn
            key={status}
            label={label}
            count={orders.length}
            stripeColor={stripe}
            terminal={status === 'completed'}
            emptyLabel="No orders"
            className="rounded-md px-1 py-1"
            width={280}
          >
            {groupedOrders.map((group) => (
              <div key={group.key} className="flex flex-col gap-1.5">
                <div
                  className="text-[10.5px] font-medium px-0.5"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  {group.projectCode || group.projectName}
                  {' / '}
                  {group.salesOrderId ?? 'No SO'}
                </div>
                <div className="flex flex-col gap-2">
                  {group.orders.map((order) => (
                    <OrderKanbanCard
                      key={order.id}
                      order={order}
                      onClick={onOrderClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </KanbanColumn>
        );
      })}
    </div>
  );
};
