/**
 * StageKanban Component (New Figma Design)
 * Kanban board view organized by design stages
 */

import { Card } from '@/shared/components/ui';
import { MoreHorizontal } from 'lucide-react';

interface DesignItem {
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
}

interface StageKanbanProps {
  items: DesignItem[];
}

const stages = [
  { id: 'concept', label: 'Concept', color: 'border-purple-400', bgColor: 'bg-purple-50' },
  { id: 'preliminary', label: 'Preliminary', color: 'border-blue-400', bgColor: 'bg-blue-50' },
  { id: 'technical', label: 'Technical', color: 'border-cyan-400', bgColor: 'bg-cyan-50' },
  { id: 'pre-production', label: 'Pre-Production', color: 'border-amber-400', bgColor: 'bg-amber-50' },
  { id: 'production-ready', label: 'Production Ready', color: 'border-green-400', bgColor: 'bg-green-50' },
];

const priorityColors: Record<string, string> = {
  'urgent': 'bg-red-500',
  'high': 'bg-orange-500',
  'medium': 'bg-yellow-500',
  'low': 'bg-gray-400',
};

function KanbanCard({ item }: { item: DesignItem }) {
  const getReadinessColor = () => {
    if (item.readinessScore >= 80) return 'text-green-600';
    if (item.readinessScore >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Card className="p-3 cursor-pointer hover:shadow-hover transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${priorityColors[item.priority]}`} />
          <span className="text-xs text-muted-foreground">{item.id}</span>
        </div>
        <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all">
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      
      <h4 className="font-medium text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {item.name}
      </h4>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{item.category}</span>
        <span className={`text-xs font-semibold ${getReadinessColor()}`}>
          {item.readinessScore}%
        </span>
      </div>

      {/* RAG Mini Summary */}
      <div className="flex items-center gap-1 mt-2">
        {item.ragStatus.red > 0 && (
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-rag-red" />
            <span className="text-[10px] text-muted-foreground">{item.ragStatus.red}</span>
          </div>
        )}
        {item.ragStatus.amber > 0 && (
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-rag-amber" />
            <span className="text-[10px] text-muted-foreground">{item.ragStatus.amber}</span>
          </div>
        )}
        {item.ragStatus.green > 0 && (
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-rag-green" />
            <span className="text-[10px] text-muted-foreground">{item.ragStatus.green}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function StageKanbanNew({ items }: StageKanbanProps) {
  const getItemsByStage = (stageId: string) => items.filter(item => item.stage === stageId);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageItems = getItemsByStage(stage.id);
        
        return (
          <div key={stage.id} className="flex-shrink-0 w-72">
            {/* Column Header */}
            <div className={`p-3 rounded-t-lg border-t-4 ${stage.color} ${stage.bgColor}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{stage.label}</h3>
                <span className="text-xs text-muted-foreground bg-white px-2 py-0.5 rounded-full">
                  {stageItems.length}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
              {stageItems.map((item) => (
                <KanbanCard key={item.id} item={item} />
              ))}
              
              {stageItems.length === 0 && (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
