/**
 * MODULE SELECTOR
 * 
 * Allows selecting and configuring engagement modules.
 */

import React, { useState } from 'react';
import {
  Building2,
  TrendingUp,
  Briefcase,
  Check,
  ChevronDown,
  Info,
  Package,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type EngagementModule = 'delivery' | 'investment' | 'advisory' | 'matflow';

interface ModuleSelectorProps {
  selectedModules: EngagementModule[];
  onChange: (modules: EngagementModule[]) => void;
  disabled?: boolean;
  allowMultiple?: boolean;
  showDescriptions?: boolean;
  className?: string;
}

interface ModuleConfig {
  id: EngagementModule;
  name: string;
  shortName: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  features: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const MODULE_CONFIGS: ModuleConfig[] = [
  {
    id: 'delivery',
    name: 'Infrastructure Delivery',
    shortName: 'Infrastructure',
    description: 'Manage construction projects, payments, and contractor workflows',
    icon: Building2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    features: [
      'Bill of Quantities (BOQ) management',
      'Interim Payment Certificates (IPC)',
      'Direct implementation requisitions',
      'Site progress monitoring',
      'Contractor management',
    ],
  },
  {
    id: 'investment',
    name: 'Infrastructure Investment',
    shortName: 'Investment',
    description: 'Track investment deals, portfolios, and financial performance',
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    features: [
      'Deal pipeline management',
      'Portfolio tracking',
      'Financial modeling',
      'Due diligence workflows',
      'Investment committee approvals',
    ],
  },
  {
    id: 'advisory',
    name: 'Advisory Services',
    shortName: 'Advisory',
    description: 'Manage consulting engagements and professional services',
    icon: Briefcase,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    features: [
      'Scope of work management',
      'Deliverable tracking',
      'Time and expense logging',
      'Client reporting',
      'Knowledge management',
    ],
  },
  {
    id: 'matflow',
    name: 'Material Flow (MatFlow)',
    shortName: 'MatFlow',
    description: 'Track materials from procurement to installation',
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    features: [
      'Material requisitions',
      'Procurement tracking',
      'Delivery scheduling',
      'Installation verification',
      'Inventory management',
    ],
  },
];

// ============================================================================
// Sub-components
// ============================================================================

interface ModuleCardProps {
  config: ModuleConfig;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  showFeatures?: boolean;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  config,
  selected,
  onToggle,
  disabled = false,
  showFeatures = true,
}) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = config.icon;
  
  return (
    <div
      className={`
        relative border-2 rounded-xl overflow-hidden transition-all
        ${selected 
          ? `${config.borderColor} ${config.bgColor}` 
          : 'border-gray-200 hover:border-gray-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Selection indicator */}
      {selected && (
        <div className={`absolute top-3 right-3 p-1 rounded-full ${config.bgColor}`}>
          <Check className={`w-4 h-4 ${config.color}`} />
        </div>
      )}
      
      {/* Main content */}
      <div
        onClick={() => !disabled && onToggle()}
        className="p-4"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{config.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{config.description}</p>
          </div>
        </div>
      </div>
      
      {/* Features toggle */}
      {showFeatures && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-500 hover:text-gray-700 border-t border-gray-100"
          >
            <span>Features</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          
          {expanded && (
            <div className="px-4 pb-4">
              <ul className="space-y-1.5">
                {config.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ModuleSelector: React.FC<ModuleSelectorProps> = ({
  selectedModules,
  onChange,
  disabled = false,
  allowMultiple = true,
  showDescriptions = true,
  className = '',
}) => {
  const handleToggle = (moduleId: EngagementModule) => {
    if (disabled) return;
    
    if (allowMultiple) {
      if (selectedModules.includes(moduleId)) {
        // Don't allow deselecting the last module
        if (selectedModules.length === 1) return;
        onChange(selectedModules.filter(m => m !== moduleId));
      } else {
        onChange([...selectedModules, moduleId]);
      }
    } else {
      onChange([moduleId]);
    }
  };
  
  return (
    <div className={className}>
      {/* Header */}
      {allowMultiple && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Info className="w-4 h-4" />
          <span>Select one or more modules for this engagement</span>
        </div>
      )}
      
      {/* Module cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {MODULE_CONFIGS.map((config) => (
          <ModuleCard
            key={config.id}
            config={config}
            selected={selectedModules.includes(config.id)}
            onToggle={() => handleToggle(config.id)}
            disabled={disabled}
            showFeatures={showDescriptions}
          />
        ))}
      </div>
      
      {/* Selected summary */}
      {selectedModules.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Selected:</span>{' '}
            {selectedModules.map(m => 
              MODULE_CONFIGS.find(c => c.id === m)?.shortName
            ).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ModuleSelector;
