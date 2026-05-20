// src/subsidiaries/advisory/ai/components/AIActionCard.tsx

import React from 'react';
import { 
  Play, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Search, 
  Plus, 
  FileText, 
  BarChart2 
} from 'lucide-react';
import { AgentAction, ActionType } from '../types/agent';
import { cn } from '@/lib/utils';

interface AIActionCardProps {
  action: AgentAction;
  onClick?: () => void;
}

export const AIActionCard: React.FC<AIActionCardProps> = ({
  action,
  onClick,
}) => {
  const getActionIcon = (type: ActionType) => {
    const icons: Partial<Record<ActionType, React.ReactNode>> = {
      navigate: <ArrowRight className="w-4 h-4" />,
      search: <Search className="w-4 h-4" />,
      create: <Plus className="w-4 h-4" />,
      create_requisition: <Plus className="w-4 h-4" />,
      generate_report: <FileText className="w-4 h-4" />,
      compare_entities: <BarChart2 className="w-4 h-4" />,
      analyze_data: <BarChart2 className="w-4 h-4" />,
    };
    return icons[type] || <Play className="w-4 h-4" />;
  };

  const getStatusConfig = (status: AgentAction['status']) => {
    const configs: Record<AgentAction['status'], { color: string; bgColor: string; borderColor: string }> = {
      suggested: { color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
      confirmed: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
      executed: { color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
      failed: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    };
    return configs[status];
  };

  const getStatusIcon = (status: AgentAction['status']) => {
    switch (status) {
      case 'executed':
        return <Check className="w-3 h-3" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const isExecutable = action.status === 'suggested' || action.status === 'confirmed';
  const statusConfig = getStatusConfig(action.status);

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        statusConfig.bgColor,
        statusConfig.borderColor
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={statusConfig.color}>{getActionIcon(action.type)}</span>
          <span className="font-medium text-sm text-gray-900">{action.label}</span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            statusConfig.color,
            statusConfig.bgColor
          )}
        >
          {getStatusIcon(action.status)}
          {action.status}
        </span>
      </div>

      {action.description && (
        <p className="text-sm text-gray-600 mb-2">{action.description}</p>
      )}

      {(action.result as any) && action.status === 'executed' && (
        <div className="mt-2 p-2 bg-green-50 rounded text-xs text-gray-600">
          Result: {typeof action.result === 'object' 
            ? JSON.stringify(action.result).substring(0, 100) + '...'
            : String(action.result)}
        </div>
      )}

      {action.error && action.status === 'failed' && (
        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
          Error: {action.error}
        </div>
      )}

      {isExecutable && onClick && (
        <button
          onClick={onClick}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Play className="w-3 h-3" />
          Execute
        </button>
      )}
    </div>
  );
};

export default AIActionCard;
