/**
 * DesignItemCard Component (New Figma Design)
 * Card view for individual design items
 */

import { Calendar, User, MoreHorizontal } from 'lucide-react';
import { Card } from '@/shared/components/ui';

interface DesignItemProps {
  item: {
    id: string;
    name: string;
    category: string;
    stage: string;
    readinessScore: number;
    ragStatus: { green: number; amber: number; red: number; na: number };
    priority: string;
    dueDate: string;
    updatedAt: string;
    assignedTo?: string;
    projectId?: string;
    itemId?: string;
  };
  onItemClick?: (item: DesignItemProps['item']) => void;
}

const stageColors: Record<string, string> = {
  'concept': 'bg-purple-100 text-purple-700 border-purple-200',
  'preliminary': 'bg-blue-100 text-blue-700 border-blue-200',
  'technical': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'pre-production': 'bg-amber-100 text-amber-700 border-amber-200',
  'production-ready': 'bg-green-100 text-green-700 border-green-200',
};

const stageLabels: Record<string, string> = {
  'concept': 'Concept',
  'preliminary': 'Preliminary',
  'technical': 'Technical',
  'pre-production': 'Pre-Production',
  'production-ready': 'Production Ready',
};

const priorityColors: Record<string, string> = {
  'urgent': 'bg-red-500',
  'high': 'bg-orange-500',
  'medium': 'bg-yellow-500',
  'low': 'bg-gray-400',
};

function ReadinessGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = () => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14 transform -rotate-90">
        <circle
          cx="28"
          cy="28"
          r="20"
          stroke="#e5e7eb"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="28"
          cy="28"
          r="20"
          stroke={getColor()}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
        {score}%
      </span>
    </div>
  );
}

function RAGSummary({ ragStatus }: { ragStatus: { green: number; amber: number; red: number; na: number } }) {
  return (
    <div className="flex items-center gap-1.5">
      {ragStatus.red > 0 && (
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-rag-red" />
          <span className="text-xs text-muted-foreground">{ragStatus.red}</span>
        </div>
      )}
      {ragStatus.amber > 0 && (
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-rag-amber" />
          <span className="text-xs text-muted-foreground">{ragStatus.amber}</span>
        </div>
      )}
      {ragStatus.green > 0 && (
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-rag-green" />
          <span className="text-xs text-muted-foreground">{ragStatus.green}</span>
        </div>
      )}
    </div>
  );
}

export default function DesignItemCardNew({ item }: DesignItemProps) {
  const handleClick = () => {
    // Navigate to item detail - for now just log
    console.log('Navigate to item:', item.id);
  };

  return (
    <Card 
      className="p-4 cursor-pointer transition-all hover:shadow-hover hover:border-primary/20 group"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${stageColors[item.stage] || stageColors['concept']}`}>
              {stageLabels[item.stage] || item.stage}
            </span>
            <div className={`w-2 h-2 rounded-full ${priorityColors[item.priority]}`} title={`${item.priority} priority`} />
          </div>
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {item.name}
          </h3>
          <p className="text-xs text-muted-foreground">{item.id}</p>
        </div>
        <button 
          className="p-1 rounded-md hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Category Badge */}
      <div className="mb-3">
        <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
          {item.category}
        </span>
      </div>

      {/* Readiness and RAG */}
      <div className="flex items-center justify-between mb-3">
        <ReadinessGauge score={item.readinessScore} />
        <RAGSummary ragStatus={item.ragStatus} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{item.dueDate}</span>
        </div>
        {item.assignedTo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{item.assignedTo.split('@')[0]}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
