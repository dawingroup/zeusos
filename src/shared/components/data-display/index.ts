/**
 * Data Display Components
 * Components for displaying data in various formats
 */

// Portal redesign primitives (Phase 7)
export { RagBadge, type RagTone, type RagBadgeProps } from './RagBadge';
export { Sparkline, type SparklineProps } from './Sparkline';
export { KPICard, KPIGrid, type KPICardProps, type KPIGridProps, type Trend } from './KPICard';
export { Banner, type BannerTone, type BannerProps } from './Banner';
// Re-exported with a v2 alias so it doesn't collide with the legacy
// `EmptyState` in `shared/components/feedback`. Both APIs coexist; new
// code should prefer this version, the legacy one stays for consumers
// still passing { icon, title, description, action: { label, onClick } }.
export {
  EmptyState as EmptyStateV2,
  type EmptyStateProps as EmptyStateV2Props,
} from './EmptyState';
export { Stepper, type StepperProps, type StepperStep } from './Stepper';
export { AvatarGroup, type AvatarPerson, type AvatarGroupProps } from './AvatarGroup';
export {
  KanbanColumn,
  KanbanCard,
  type KanbanColumnProps,
  type KanbanCardProps,
} from './KanbanColumn';
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type DataTableFilter,
  type CellType,
  type StatusMapEntry,
} from './DataTable';

// Legacy primitives — still in use across modules
export { StatsCard } from './StatsCard';
export { ColoredStatsCard, type StatsCardColor } from './ColoredStatsCard';
export { StatusBadge } from './StatusBadge';
export { ProgressBar } from './ProgressBar';
export { ModuleDashboardHeader } from './ModuleDashboardHeader';
export { QuickActionsGrid } from './QuickActionsGrid';
