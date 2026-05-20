/**
 * Kanban Board - Main board with all stage columns
 */

import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { DealCard } from './DealCard';

type DealStage = 
  | 'screening'
  | 'initial_review'
  | 'preliminary_dd'
  | 'detailed_dd'
  | 'ic_memo'
  | 'ic_approval'
  | 'negotiation'
  | 'documentation'
  | 'closing'
  | 'post_closing';

interface Deal {
  id: string;
  name: string;
  dealCode: string;
  stage: DealStage;
  sector: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetInvestment: { amount: number; currency: string };
  expectedCloseDate?: Date;
  currentStageDays: number;
  geography: { country: string };
  team?: Array<{ userId: string; name: string; avatarUrl?: string }>;
}

interface StageConfig {
  stage: DealStage;
  label: string;
  maxDays?: number;
  hasGate: boolean;
}

const STAGE_CONFIGS: StageConfig[] = [
  { stage: 'screening', label: 'Screening', maxDays: 14, hasGate: false },
  { stage: 'initial_review', label: 'Initial Review', maxDays: 21, hasGate: true },
  { stage: 'preliminary_dd', label: 'Preliminary DD', maxDays: 30, hasGate: true },
  { stage: 'detailed_dd', label: 'Detailed DD', maxDays: 60, hasGate: true },
  { stage: 'ic_memo', label: 'IC Memo', maxDays: 14, hasGate: true },
  { stage: 'ic_approval', label: 'IC Approval', maxDays: 7, hasGate: true },
  { stage: 'negotiation', label: 'Negotiation', maxDays: 45, hasGate: false },
  { stage: 'documentation', label: 'Documentation', maxDays: 30, hasGate: false },
  { stage: 'closing', label: 'Closing', maxDays: 14, hasGate: true },
  { stage: 'post_closing', label: 'Post-Closing', hasGate: false },
];

interface KanbanBoardProps {
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onStageChange: (dealId: string, newStage: DealStage) => void;
}

export function KanbanBoard({ deals, onDealClick, onStageChange }: KanbanBoardProps) {
  const [draggingDeal, setDraggingDeal] = useState<Deal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  // Group deals by stage
  const dealsByStage = deals.reduce((acc, deal) => {
    if (!acc[deal.stage]) acc[deal.stage] = [];
    acc[deal.stage].push(deal);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  const handleDragStart = (deal: Deal) => {
    setDraggingDeal(deal);
  };

  const handleDragEnd = () => {
    if (draggingDeal && dragOverStage && draggingDeal.stage !== dragOverStage) {
      onStageChange(draggingDeal.id, dragOverStage);
    }
    setDraggingDeal(null);
    setDragOverStage(null);
  };

  const handleDragOver = (stage: DealStage) => {
    setDragOverStage(stage);
  };

  return (
    <div className="flex gap-4 h-full p-4 overflow-x-auto bg-gray-50">
      {STAGE_CONFIGS.map((config) => (
        <KanbanColumn
          key={config.stage}
          config={config}
          deals={dealsByStage[config.stage] || []}
          isDropTarget={dragOverStage === config.stage}
          onDragOver={() => handleDragOver(config.stage)}
          onDrop={handleDragEnd}
        >
          {(dealsByStage[config.stage] || []).map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal)}
              isDragging={draggingDeal?.id === deal.id}
              isOverdue={config.maxDays ? deal.currentStageDays > config.maxDays : false}
              onDragStart={() => handleDragStart(deal)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </KanbanColumn>
      ))}
    </div>
  );
}

export default KanbanBoard;
