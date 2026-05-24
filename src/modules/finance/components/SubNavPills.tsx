// Shared pill sub-navigation for finance sections.
// Renders a horizontal scrollable row of pill buttons.

import { useNavigate, useLocation } from 'react-router-dom';

export interface SubNavPill {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

interface SubNavPillsProps {
  pills: SubNavPill[];
}

export function SubNavPills({ pills }: SubNavPillsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {pills.map((pill) => {
        const Icon = pill.icon;
        const isActive = location.pathname === pill.path;
        return (
          <button
            key={pill.id}
            onClick={() => navigate(pill.path)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              isActive
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-[var(--bg-sunken)] text-muted-foreground border border-[var(--border-subtle)] hover:bg-[var(--bg-sunken)] hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
