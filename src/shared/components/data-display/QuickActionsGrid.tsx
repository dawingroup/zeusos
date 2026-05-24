/**
 * QuickActionsGrid Component
 * Consistent grid of shortcut buttons for module dashboards
 */

import { LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface QuickActionsGridProps {
  actions: QuickAction[];
  columns?: 2 | 3 | 4;
  title?: string;
}

export function QuickActionsGrid({
  actions,
  columns = 3,
  title = 'Quick Actions',
}: QuickActionsGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-5">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      <div className={`grid ${gridCols[columns]} gap-3`}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-sunken)] hover:border-[var(--border-default)] transition-colors text-left group"
            >
              <div className="p-2 bg-[var(--bg-sunken)] rounded-lg group-hover:bg-[var(--bg-sunken)] transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{action.label}</div>
                {action.description && (
                  <div className="text-xs text-muted-foreground truncate">{action.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
