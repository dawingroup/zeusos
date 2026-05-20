/**
 * ModuleDashboardHeader Component
 * Consistent header bar for module dashboard pages
 */

import { LucideIcon } from 'lucide-react';

interface ActionConfig {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

interface ModuleDashboardHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor?: string;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
}

export function ModuleDashboardHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = '#6366f1',
  primaryAction,
  secondaryAction,
}: ModuleDashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className="h-6 w-6" style={{ color: iconColor }} />
          {title}
        </h1>
        <p className="text-gray-500 mt-1">{subtitle}</p>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: iconColor }}
            >
              {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
