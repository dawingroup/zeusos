/**
 * SnapshotStrip Component
 * Birds-eye view of task inbox with 4 clickable quadrants:
 * Burning | Next Up | Stuck | Recently Moved
 */

import {
  Flame,
  ArrowRight,
  PauseCircle,
  Activity,
} from 'lucide-react';

import { Card } from '@/core/components/ui/card';

import type { SnapshotStats, SnapshotFilter } from '../../hooks/useEmployeeTaskInbox';

// ============================================
// Types
// ============================================

interface SnapshotStripProps {
  stats: SnapshotStats;
  activeFilter: SnapshotFilter;
  onFilterChange: (filter: SnapshotFilter) => void;
}

// ============================================
// Quadrant Component
// ============================================

interface QuadrantProps {
  label: string;
  count: number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  isActive: boolean;
  onClick: () => void;
}

function Quadrant({
  label,
  count,
  subtitle,
  icon,
  accentColor,
  bgColor,
  borderColor,
  isActive,
  onClick,
}: QuadrantProps) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
        isActive ? `ring-2 ${borderColor} shadow-md` : 'hover:bg-muted/30'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <div className={accentColor}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${count > 0 ? accentColor : 'text-muted-foreground'}`}>
              {count}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// SnapshotStrip Component
// ============================================

export function SnapshotStrip({ stats, activeFilter, onFilterChange }: SnapshotStripProps) {
  const handleClick = (filter: SnapshotFilter) => {
    // Toggle off if clicking the same filter
    onFilterChange(activeFilter === filter ? null : filter);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Quadrant
        label="Burning"
        count={stats.burning.count}
        subtitle={stats.burning.topTask}
        icon={<Flame className="h-5 w-5" />}
        accentColor="text-red-600"
        bgColor="bg-red-100 dark:bg-red-950/30"
        borderColor="ring-red-400"
        isActive={activeFilter === 'burning'}
        onClick={() => handleClick('burning')}
      />
      <Quadrant
        label="Next Up"
        count={stats.nextUp.count}
        subtitle={stats.nextUp.nearestDue ? `Nearest: ${stats.nextUp.nearestDue}` : undefined}
        icon={<ArrowRight className="h-5 w-5" />}
        accentColor="text-blue-600"
        bgColor="bg-blue-100 dark:bg-blue-950/30"
        borderColor="ring-blue-400"
        isActive={activeFilter === 'nextUp'}
        onClick={() => handleClick('nextUp')}
      />
      <Quadrant
        label="Stuck"
        count={stats.stuck.count}
        subtitle={stats.stuck.oldestTask}
        icon={<PauseCircle className="h-5 w-5" />}
        accentColor="text-amber-600"
        bgColor="bg-amber-100 dark:bg-amber-950/30"
        borderColor="ring-amber-400"
        isActive={activeFilter === 'stuck'}
        onClick={() => handleClick('stuck')}
      />
      <Quadrant
        label="Moved"
        count={stats.moved.count}
        subtitle="Last 24 hours"
        icon={<Activity className="h-5 w-5" />}
        accentColor="text-green-600"
        bgColor="bg-green-100 dark:bg-green-950/30"
        borderColor="ring-green-400"
        isActive={activeFilter === 'moved'}
        onClick={() => handleClick('moved')}
      />
    </div>
  );
}

export default SnapshotStrip;
