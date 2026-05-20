// src/subsidiaries/advisory/ai/components/AIDomainIndicator.tsx

import React from 'react';
import { 
  Construction, 
  TrendingUp, 
  HandMetal,
  Truck, 
  BarChart3, 
  Settings, 
  HelpCircle 
} from 'lucide-react';
import { AgentDomain } from '../types/agent';
import { cn } from '@/lib/utils';

interface AIDomainIndicatorProps {
  domain: AgentDomain;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export const AIDomainIndicator: React.FC<AIDomainIndicatorProps> = ({
  domain,
  size = 'medium',
  showLabel = true,
}) => {
  const getDomainConfig = (domain: AgentDomain) => {
    const configs: Record<AgentDomain, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
      general: {
        icon: <HelpCircle className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'General',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
      },
      infrastructure: {
        icon: <Construction className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'Infrastructure',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
      },
      investment: {
        icon: <TrendingUp className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'Investment',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      },
      advisory: {
        icon: <HandMetal className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'Advisory',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      },
      matflow: {
        icon: <Truck className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'MatFlow',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
      },
      analytics: {
        icon: <BarChart3 className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'Analytics',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100',
      },
      settings: {
        icon: <Settings className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />,
        label: 'Settings',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
      },
    };
    return configs[domain];
  };

  const config = getDomainConfig(domain);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border',
        config.bgColor,
        config.color,
        size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
      title={`Currently in ${config.label} context`}
    >
      {config.icon}
      {showLabel && <span className="font-medium">{config.label}</span>}
    </div>
  );
};

export default AIDomainIndicator;
