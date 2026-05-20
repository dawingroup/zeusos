/**
 * ViewModeToggle Component
 * Toggle between different view modes (grid, list, kanban, etc.)
 * Follows Finishes Design Manager pattern
 */

import { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ViewMode {
  id: string;
  icon: LucideIcon;
  label?: string;
}

interface ViewModeToggleProps {
  modes: ViewMode[];
  activeMode: string;
  onModeChange: (mode: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function ViewModeToggle({
  modes,
  activeMode,
  onModeChange,
  className,
  size = 'md',
}: ViewModeToggleProps) {
  const iconSizeClasses = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonPaddingClasses = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <div className={cn("flex bg-gray-100 rounded-lg p-1", className)}>
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              buttonPaddingClasses,
              "rounded-md transition-colors flex items-center gap-1.5",
              isActive
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
            title={mode.label}
            aria-label={mode.label || mode.id}
            aria-pressed={isActive}
          >
            <Icon className={iconSizeClasses} />
            {mode.label && size === 'md' && (
              <span className="text-sm hidden md:inline">{mode.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
