/**
 * Kanban Column - Single stage column with droppable area
 */

import { ReactNode } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

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
  targetInvestment: { amount: number; currency: string };
  currentStageDays: number;
}

interface StageConfig {
  stage: DealStage;
  label: string;
  maxDays?: number;
  hasGate: boolean;
}

interface KanbanColumnProps {
  config: StageConfig;
  deals: Deal[];
  children: ReactNode;
  isDropTarget: boolean;
  onDragOver: () => void;
  onDrop: () => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function getStageColor(stage: DealStage): string {
  const colors: Record<DealStage, string> = {
    screening: 'bg-gray-500',
    initial_review: 'bg-blue-500',
    preliminary_dd: 'bg-indigo-500',
    detailed_dd: 'bg-violet-500',
    ic_memo: 'bg-purple-500',
    ic_approval: 'bg-fuchsia-500',
    negotiation: 'bg-pink-500',
    documentation: 'bg-rose-500',
    closing: 'bg-emerald-500',
    post_closing: 'bg-green-600',
  };
  return colors[stage];
}

export function KanbanColumn({ 
  config,
  deals, 
  children,
  isDropTarget,
  onDragOver,
  onDrop
}: KanbanColumnProps) {
  const totalValue = deals.reduce(
    (sum, deal) => sum + deal.targetInvestment.amount, 
    0
  );

  // Check for deals exceeding stage time limit
  const overdueDeals = deals.filter(deal => 
    config.maxDays && deal.currentStageDays > config.maxDays
  );

  return (
    <div 
      className={`w-72 flex-shrink-0 flex flex-col bg-white rounded-lg border transition-all ${
        isDropTarget ? 'ring-2 ring-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStageColor(config.stage)}`} />
            <span className="font-medium text-sm">{config.label}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {deals.length}
            </span>
            {config.hasGate && (
              <span title="Stage gate required">
                <Lock className="w-3 h-3 text-gray-400" />
              </span>
            )}
          </div>
          {overdueDeals.length > 0 && (
            <div className="flex items-center text-amber-500" title={`${overdueDeals.length} overdue`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatCurrency(totalValue)}
        </div>
      </div>
      
      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
        {children}
        
        {deals.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">No deals in this stage</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanColumn;
