/**
 * PipelineKanban
 * Kanban board for deal stages with stage totals.
 * Migrated to the shared <KanbanColumn> primitive matching the portal redesign.
 */

import type { CRMDeal, CRMDealStage } from '../../types';
import { DealCard } from '../deals/DealCard';
import {
  CRM_ACTIVE_DEAL_STAGES,
  CRM_DEAL_STAGE_LABELS,
} from '../../constants/crm.constants';
import { KanbanColumn } from '@/shared/components/data-display';

interface PipelineKanbanProps {
  dealsByStage: Record<CRMDealStage, CRMDeal[]>;
  onStageDrop?: (dealId: string, newStage: CRMDealStage) => void;
}

function formatTotal(value: number): string {
  if (value <= 0) return '';
  if (value >= 1_000_000) return `UGX ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `UGX ${(value / 1_000).toFixed(0)}K`;
  return `UGX ${value.toLocaleString()}`;
}

function Column({
  stage,
  deals,
  onStageDrop,
}: {
  stage: CRMDealStage;
  deals: CRMDeal[];
  onStageDrop?: (dealId: string, newStage: CRMDealStage) => void;
}) {
  const total = deals.reduce((sum, d) => sum + d.estimatedValue, 0);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'transparent';
    const dealId = e.dataTransfer.getData('dealId');
    if (dealId && onStageDrop) onStageDrop(dealId, stage);
  };

  return (
    <KanbanColumn
      label={CRM_DEAL_STAGE_LABELS[stage]}
      count={deals.length}
      total={formatTotal(total)}
      terminal={stage === 'won'}
      emptyLabel="No deals"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="rounded-md transition-colors px-1 py-1"
    >
      {deals.map((deal) => (
        <div
          key={deal.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('dealId', deal.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <DealCard deal={deal} compact />
        </div>
      ))}
    </KanbanColumn>
  );
}

export function PipelineKanban({ dealsByStage, onStageDrop }: PipelineKanbanProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {CRM_ACTIVE_DEAL_STAGES.map((stage) => (
        <Column
          key={stage}
          stage={stage}
          deals={dealsByStage[stage] || []}
          onStageDrop={onStageDrop}
        />
      ))}
    </div>
  );
}
