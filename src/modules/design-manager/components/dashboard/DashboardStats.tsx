/**
 * DashboardStats Component
 * Displays overview statistics for design items
 */

import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface DesignItem {
  id: string;
  stage: string;
  ragStatus: { red: number; amber: number; green: number; na: number };
  priority: string;
}

interface DashboardStatsProps {
  items: DesignItem[];
}

const FINAL_RELEASE_STAGES = new Set([
  'production-ready',
  'procure-received',
  'arch-approved',
  'const-complete',
]);

export default function DashboardStats({ items }: DashboardStatsProps) {
  // Calculate statistics
  const totalItems = items.length;
  const inProgress = items.filter(i => !FINAL_RELEASE_STAGES.has(i.stage)).length;
  const productionReady = items.filter(i => FINAL_RELEASE_STAGES.has(i.stage)).length;
  const criticalItems = items.filter(i => i.ragStatus.red > 2 || i.priority === 'urgent').length;

  return (
    <div className="mb-6">
      <KPIGrid cols={4}>
        <KPICard label="Total Designs" value={totalItems} delta="Active projects" />
        <KPICard
          label="In Progress"
          value={inProgress}
          delta="↑ 12% from last week"
          trend="up"
        />
        <KPICard
          label="Production Ready"
          value={productionReady}
          delta="Ready to manufacture"
          trend="up"
        />
        <KPICard
          label="Needs Attention"
          value={criticalItems}
          delta="Critical items"
          trend={criticalItems > 0 ? 'down' : undefined}
        />
      </KPIGrid>
    </div>
  );
}
