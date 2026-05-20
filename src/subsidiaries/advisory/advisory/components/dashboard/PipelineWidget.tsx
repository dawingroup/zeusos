/**
 * Pipeline Widget
 * 
 * Shows deal pipeline summary on the dashboard.
 */

import React from 'react';
import { Target, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface PipelineDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  daysInStage: number;
}

export function PipelineWidget() {
  // Mock pipeline data - would come from hooks in production
  const pipelineDeals: PipelineDeal[] = [
    { id: '1', name: 'Solar Plant Alpha', value: 15000000, stage: 'Due Diligence', daysInStage: 12 },
    { id: '2', name: 'Hospital Complex B', value: 22000000, stage: 'Negotiation', daysInStage: 8 },
    { id: '3', name: 'Water Treatment C', value: 8000000, stage: 'IC Approval', daysInStage: 3 },
  ];
  
  const stageConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    'Due Diligence': { color: 'bg-blue-100 text-blue-800', icon: <Clock className="h-3 w-3" /> },
    'Negotiation': { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="h-3 w-3" /> },
    'IC Approval': { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
  };
  
  const totalValue = pipelineDeals.reduce((sum, deal) => sum + deal.value, 0);
  
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Deal Pipeline</h3>
        </div>
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(totalValue)}
        </span>
      </div>
      
      <div className="p-4 space-y-3">
        {pipelineDeals.map((deal) => {
          const config = stageConfig[deal.stage] || {
            color: 'bg-gray-100 text-gray-800',
            icon: <Clock className="h-3 w-3" />,
          };
          
          return (
            <div
              key={deal.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div>
                <p className="font-medium text-gray-900">{deal.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${config.color}`}
                  >
                    {config.icon}
                    {deal.stage}
                  </span>
                  <span className="text-xs text-gray-500">
                    {deal.daysInStage} days
                  </span>
                </div>
              </div>
              <p className="font-medium text-gray-900">{formatCurrency(deal.value)}</p>
            </div>
          );
        })}
        
        {pipelineDeals.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No deals in pipeline
          </div>
        )}
      </div>
      
      <div className="p-4 border-t">
        <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All Deals →
        </button>
      </div>
    </div>
  );
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

export default PipelineWidget;
