// ============================================================================
// DATA SOURCE BADGE COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Badge indicating data source origin
// ============================================================================

import React from 'react';
import { Newspaper, Share2, BarChart3, Gavel, Building2, Lightbulb, Plug } from 'lucide-react';

import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { DataSourceType, DATA_SOURCES } from '../../constants';

interface DataSourceBadgeProps {
  source: DataSourceType;
  showLabel?: boolean;
}

const SOURCE_ICONS: Record<DataSourceType, React.ReactNode> = {
  news: <Newspaper className="h-3 w-3" />,
  social: <Share2 className="h-3 w-3" />,
  financial: <BarChart3 className="h-3 w-3" />,
  regulatory: <Gavel className="h-3 w-3" />,
  industry: <Building2 className="h-3 w-3" />,
  internal: <Lightbulb className="h-3 w-3" />,
  api: <Plug className="h-3 w-3" />,
};

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({
  source,
  showLabel = true,
}) => {
  const sourceConfig = DATA_SOURCES.find(s => s.id === source);
  
  if (!sourceConfig) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1"
            style={{
              backgroundColor: `${sourceConfig.color}20`,
              color: sourceConfig.color,
              borderColor: sourceConfig.color,
            }}
          >
            {SOURCE_ICONS[source]}
            {showLabel && <span>{sourceConfig.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{sourceConfig.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface MultiSourceBadgeProps {
  sources: DataSourceType[];
  maxDisplay?: number;
}

export const MultiSourceBadge: React.FC<MultiSourceBadgeProps> = ({
  sources,
  maxDisplay = 3,
}) => {
  const displaySources = sources.slice(0, maxDisplay);
  const remaining = sources.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {displaySources.map(source => (
        <DataSourceBadge key={source} source={source} showLabel={false} />
      ))}
      {remaining > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">+{remaining}</Badge>
            </TooltipTrigger>
            <TooltipContent>
              {sources.slice(maxDisplay).map(s => DATA_SOURCES.find(d => d.id === s)?.label).join(', ')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default DataSourceBadge;
