// ============================================================================
// MODULE SOURCE BADGE
// DawinOS v2.0 - Intelligence Layer
// Shows which module data/insight comes from
// ============================================================================

import React from 'react';
import {
  Users,
  Briefcase,
  Building2,
  BarChart3,
  DollarSign,
  TrendingUp,
  Package,
  Link2,
} from 'lucide-react';

import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { SOURCE_MODULES, SourceModuleId } from '../../constants';

interface ModuleSourceBadgeProps {
  module: SourceModuleId;
  size?: 'small' | 'medium';
  showIcon?: boolean;
  variant?: 'filled' | 'outlined';
}

const moduleIcons: Partial<Record<SourceModuleId, React.ReactNode>> = {
  hr_central: <Users className="h-3 w-3" />,
  ceo_strategy: <Briefcase className="h-3 w-3" />,
  financial: <Building2 className="h-3 w-3" />,
  staff_performance: <BarChart3 className="h-3 w-3" />,
  capital_hub: <DollarSign className="h-3 w-3" />,
  market_intelligence: <TrendingUp className="h-3 w-3" />,
  matflow: <Package className="h-3 w-3" />,
  advisory: <Link2 className="h-3 w-3" />,
};

export const ModuleSourceBadge: React.FC<ModuleSourceBadgeProps> = ({
  module,
  size = 'small',
  showIcon = true,
  variant = 'filled',
}) => {
  const config = SOURCE_MODULES.find(m => m.id === module);
  if (!config) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant === 'outlined' ? 'outline' : 'default'}
            className={`gap-1 ${size === 'small' ? 'text-xs py-0 h-5' : 'text-sm py-0.5 h-6'}`}
            style={{
              backgroundColor: variant === 'filled' ? config.color : 'transparent',
              color: variant === 'filled' ? 'white' : config.color,
              borderColor: config.color,
            }}
          >
            {showIcon && moduleIcons[module]}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{config.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface MultiModuleSourceProps {
  modules: SourceModuleId[];
  maxDisplay?: number;
}

export const MultiModuleSource: React.FC<MultiModuleSourceProps> = ({
  modules,
  maxDisplay = 3,
}) => {
  const displayModules = modules.slice(0, maxDisplay);
  const remainingCount = modules.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {displayModules.map((module) => (
        <ModuleSourceBadge key={module} module={module} size="small" />
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs py-0 h-5">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
};

export default ModuleSourceBadge;
