/**
 * DesignItemList Component (New Figma Design)
 * List/table view for design items
 */

import { Calendar, ChevronRight } from 'lucide-react';

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

interface DesignItemListProps {
  items: DesignItem[];
}

const stageColors: Record<string, string> = {
  'concept': 'bg-purple-100 text-purple-700',
  'preliminary': 'bg-blue-100 text-blue-700',
  'technical': 'bg-cyan-100 text-cyan-700',
  'pre-production': 'bg-amber-100 text-amber-700',
  'production-ready': 'bg-green-100 text-green-700',
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

function RAGBar({ ragStatus }: { ragStatus: { green: number; amber: number; red: number; na: number } }) {
  const total = ragStatus.green + ragStatus.amber + ragStatus.red + ragStatus.na;
  if (total === 0) return null;
  
  const greenWidth = (ragStatus.green / total) * 100;
  const amberWidth = (ragStatus.amber / total) * 100;
  const redWidth = (ragStatus.red / total) * 100;

  return (
    <div className="flex h-2 w-24 rounded-full overflow-hidden bg-gray-200">
      <div className="bg-rag-green" style={{ width: `${greenWidth}%` }} />
      <div className="bg-rag-amber" style={{ width: `${amberWidth}%` }} />
      <div className="bg-rag-red" style={{ width: `${redWidth}%` }} />
    </div>
  );
}

function ReadinessBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'bg-rag-green';
    if (score >= 60) return 'bg-rag-amber';
    return 'bg-rag-red';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${getColor()} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium w-8">{score}%</span>
    </div>
  );
}

export default function DesignItemListNew({ items }: DesignItemListProps) {
  return (
    <div className="divide-y divide-border">
      {/* Header Row */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground">
        <div className="col-span-4">Design</div>
        <div className="col-span-2">Stage</div>
        <div className="col-span-2">Readiness</div>
        <div className="col-span-2">RAG Status</div>
        <div className="col-span-2">Due Date</div>
      </div>

      {/* List Items */}
      {items.map((item) => (
        <div 
          key={item.id}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-4 hover:bg-accent/50 cursor-pointer transition-colors group"
        >
          {/* Design Info */}
          <div className="col-span-4 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${priorityColors[item.priority]}`} />
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground">{item.id} • {item.category}</p>
            </div>
          </div>

          {/* Stage */}
          <div className="col-span-2 flex items-center">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${stageColors[item.stage]}`}>
              {stageLabels[item.stage]}
            </span>
          </div>

          {/* Readiness */}
          <div className="col-span-2 flex items-center">
            <ReadinessBar score={item.readinessScore} />
          </div>

          {/* RAG Status */}
          <div className="col-span-2 flex items-center">
            <RAGBar ragStatus={item.ragStatus} />
          </div>

          {/* Due Date */}
          <div className="col-span-2 flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{item.dueDate}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="px-4 py-12 text-center text-muted-foreground">
          <p>No design items found</p>
        </div>
      )}
    </div>
  );
}
