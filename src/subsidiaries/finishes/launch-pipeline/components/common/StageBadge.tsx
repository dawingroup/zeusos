/**
 * Stage Badge Component
 * Displays the current pipeline stage with appropriate styling
 */

import React from 'react';
import {
  Lightbulb,
  Search,
  PenTool,
  Wrench,
  Camera,
  FileText,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import type { PipelineStage } from '../../types/stage.types';

interface StageBadgeProps {
  stage: PipelineStage;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const stageConfig: Record<PipelineStage, {
  label: string;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  idea: {
    label: 'Idea',
    icon: Lightbulb,
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
  },
  research: {
    label: 'Research',
    icon: Search,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
  },
  design: {
    label: 'Design',
    icon: PenTool,
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300',
  },
  prototype: {
    label: 'Prototype',
    icon: Wrench,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
  },
  photography: {
    label: 'Photography',
    icon: Camera,
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
  },
  documentation: {
    label: 'Documentation',
    icon: FileText,
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
  },
  launched: {
    label: 'Launched',
    icon: Rocket,
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
  },
};

const sizeClasses = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'w-3 h-3',
    gap: 'gap-1',
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'w-4 h-4',
    gap: 'gap-1.5',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'w-5 h-5',
    gap: 'gap-2',
  },
};

export const StageBadge: React.FC<StageBadgeProps> = ({
  stage,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className = '',
}) => {
  const config = stageConfig[stage];
  const sizes = sizeClasses[size];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.badge}
        ${config.bgColor} ${config.textColor}
        border ${config.borderColor}
        rounded-full font-medium
        ${className}
      `.trim()}
    >
      {showIcon && <Icon className={sizes.icon} />}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

export default StageBadge;
