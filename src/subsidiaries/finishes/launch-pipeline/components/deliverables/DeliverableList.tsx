/**
 * Deliverable List Component
 * Displays a list of deliverables grouped by stage or type
 */

import React, { useState } from 'react';
import { Grid, List, Filter, ChevronDown, ChevronRight, Package } from 'lucide-react';
import type { ProductDeliverable } from '../../types/product.types';
import type { PipelineStage, DeliverableType } from '../../types/stage.types';
import { DeliverableCard } from './DeliverableCard';
import { formatDeliverableType, formatStage } from '../../utils/formatting';

type GroupBy = 'stage' | 'type' | 'none';
type ViewMode = 'grid' | 'list';

interface DeliverableListProps {
  deliverables: ProductDeliverable[];
  groupBy?: GroupBy;
  defaultViewMode?: ViewMode;
  onView?: (deliverable: ProductDeliverable) => void;
  onDownload?: (deliverable: ProductDeliverable) => void;
  onDelete?: (deliverable: ProductDeliverable) => void;
  showActions?: boolean;
  emptyMessage?: string;
  className?: string;
}

interface GroupedDeliverables {
  key: string;
  label: string;
  deliverables: ProductDeliverable[];
}

const groupDeliverables = (
  deliverables: ProductDeliverable[],
  groupBy: GroupBy
): GroupedDeliverables[] => {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All Deliverables', deliverables }];
  }

  const groups: Record<string, ProductDeliverable[]> = {};

  for (const deliverable of deliverables) {
    const key = groupBy === 'stage' ? deliverable.stage : deliverable.type;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(deliverable);
  }

  return Object.entries(groups).map(([key, items]) => ({
    key,
    label: groupBy === 'stage'
      ? formatStage(key as PipelineStage)
      : formatDeliverableType(key as DeliverableType),
    deliverables: items,
  }));
};

export const DeliverableList: React.FC<DeliverableListProps> = ({
  deliverables,
  groupBy = 'stage',
  defaultViewMode = 'grid',
  onView,
  onDownload,
  onDelete,
  showActions = true,
  emptyMessage = 'No deliverables yet',
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));
  const [currentGroupBy, setCurrentGroupBy] = useState<GroupBy>(groupBy);

  const groups = groupDeliverables(deliverables, currentGroupBy);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groups.map(g => g.key)));
  };

  if (deliverables.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Group by selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={currentGroupBy}
              onChange={(e) => {
                setCurrentGroupBy(e.target.value as GroupBy);
                expandAll();
              }}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="stage">Group by Stage</option>
              <option value="type">Group by Type</option>
              <option value="none">No Grouping</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.key);

          return (
            <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Group header */}
              {currentGroupBy !== 'none' && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900">{group.label}</span>
                    <span className="text-sm text-gray-500">
                      ({group.deliverables.length})
                    </span>
                  </div>
                </button>
              )}

              {/* Group content */}
              {(isExpanded || currentGroupBy === 'none') && (
                <div className="p-4">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {group.deliverables.map((deliverable) => (
                        <DeliverableCard
                          key={deliverable.id}
                          deliverable={deliverable}
                          onView={onView}
                          onDownload={onDownload}
                          onDelete={onDelete}
                          showActions={showActions}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {group.deliverables.map((deliverable) => (
                        <DeliverableCard
                          key={deliverable.id}
                          deliverable={deliverable}
                          onView={onView}
                          onDownload={onDownload}
                          onDelete={onDelete}
                          showActions={showActions}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeliverableList;
