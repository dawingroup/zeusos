/**
 * Saved pipeline views and user preferences
 */

import { DealStage } from './deal-stage';
import { PipelineFilters } from './pipeline';

export interface PipelineView {
  id: string;
  name: string;
  description?: string;
  type: ViewType;
  filters: PipelineFilters;
  sortBy: SortConfig;
  groupBy?: GroupConfig;
  columns: ColumnVisibility;
  isDefault: boolean;
  isShared: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ViewType = 'kanban' | 'list' | 'table' | 'timeline';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface GroupConfig {
  field: 'sector' | 'dealType' | 'country' | 'priority' | 'assignee';
}

export interface ColumnVisibility {
  dealCode: boolean;
  name: boolean;
  sector: boolean;
  dealType: boolean;
  stage: boolean;
  targetAmount: boolean;
  geography: boolean;
  priority: boolean;
  daysInStage: boolean;
  expectedCloseDate: boolean;
  dueDiligenceStatus: boolean;
  dealLead: boolean;
}

// Default column visibility
export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  dealCode: true,
  name: true,
  sector: true,
  dealType: true,
  stage: true,
  targetAmount: true,
  geography: true,
  priority: true,
  daysInStage: true,
  expectedCloseDate: true,
  dueDiligenceStatus: true,
  dealLead: true,
};

// User pipeline preferences
export interface UserPipelinePreferences {
  userId: string;
  defaultViewId?: string;
  collapsedStages: DealStage[];
  cardSize: 'compact' | 'normal' | 'expanded';
  showValues: boolean;
  showDaysInStage: boolean;
  autoRefresh: boolean;
  refreshInterval: number;   // Seconds
}

// Default user preferences
export const DEFAULT_USER_PREFERENCES: Omit<UserPipelinePreferences, 'userId'> = {
  collapsedStages: [],
  cardSize: 'normal',
  showValues: true,
  showDaysInStage: true,
  autoRefresh: true,
  refreshInterval: 30,
};

// View type display names
export function getViewTypeDisplayName(type: ViewType): string {
  const names: Record<ViewType, string> = {
    kanban: 'Kanban Board',
    list: 'List View',
    table: 'Table View',
    timeline: 'Timeline View',
  };
  return names[type] || type;
}

// Group field display names
export function getGroupFieldDisplayName(field: GroupConfig['field']): string {
  const names: Record<GroupConfig['field'], string> = {
    sector: 'Sector',
    dealType: 'Deal Type',
    country: 'Country',
    priority: 'Priority',
    assignee: 'Assignee',
  };
  return names[field] || field;
}
