/**
 * Project Dashboard Card
 * Displays detailed project information when a project is selected
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, User, FolderOpen, Package, Clock, 
  Edit2, X, ExternalLink, ArrowRight
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { DesignProject, DesignItem, DesignStage } from '../../types';
import { STAGE_ORDER } from '../../utils/stage-gate';
import { STAGE_LABELS } from '../../utils/formatting';

export interface ProjectDashboardCardProps {
  project: DesignProject;
  items: DesignItem[];
  onEdit: () => void;
  onClose: () => void;
  onViewItem: (item: DesignItem) => void;
  className?: string;
}

const STATUS_CONFIG = {
  'active': { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  'on-hold': { bg: 'bg-amber-100', text: 'text-amber-800', label: 'On Hold' },
  'completed': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Completed' },
  'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
};

const FINAL_RELEASE_STAGES = new Set<DesignStage>([
  'production-ready',
  'procure-received',
  'arch-approved',
  'const-complete',
]);

function formatDate(timestamp: unknown): string {
  if (!timestamp) return '-';
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if ((timestamp as any).toDate) {
    date = (timestamp as any).toDate();
  } else if ((timestamp as any).seconds !== undefined) {
    date = new Date((timestamp as any).seconds * 1000);
  } else {
    date = new Date(timestamp as string);
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectDashboardCard({
  project,
  items,
  onEdit,
  onClose,
  onViewItem,
  className,
}: ProjectDashboardCardProps) {
  // Calculate project statistics
  const stats = useMemo(() => {
    const projectItems = items.filter(item => item.projectId === project.id);
    const totalItems = projectItems.length;
    
    // Items by stage
    const byStage = STAGE_ORDER.reduce((acc, stage) => {
      acc[stage] = projectItems.filter(item => item.currentStage === stage).length;
      return acc;
    }, {} as Record<DesignStage, number>);
    
    // Average readiness
    const avgReadiness = totalItems > 0 
      ? Math.round(projectItems.reduce((sum, item) => sum + item.overallReadiness, 0) / totalItems)
      : 0;
    
    // Items needing attention (low readiness or urgent)
    const needsAttention = projectItems.filter(
      item => item.overallReadiness < 50 || item.priority === 'urgent'
    ).length;
    
    // "Ready" means item reached terminal stage in its workflow family.
    const productionReady = projectItems.filter((item) =>
      FINAL_RELEASE_STAGES.has(item.currentStage),
    ).length;
    
    return { totalItems, byStage, avgReadiness, needsAttention, productionReady, projectItems };
  }, [items, project.id]);

  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG['active'];

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusConfig.bg, statusConfig.text)}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{project.code}</p>
            {project.description && (
              <p className="text-sm text-gray-600 mt-1 max-w-xl">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit project"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Project Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Project Details</h3>
            <div className="space-y-2 text-sm">
              {project.customerName && (
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>{project.customerName}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Created {formatDate(project.createdAt)}</span>
              </div>
              {project.dueDate && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Due {formatDate(project.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Statistics</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gray-50 rounded-lg text-center">
                <p className="text-xl font-bold text-gray-900">{stats.totalItems}</p>
                <p className="text-xs text-gray-500">Total Items</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-center">
                <p className="text-xl font-bold text-gray-900">{stats.avgReadiness}%</p>
                <p className="text-xs text-gray-500">Avg Readiness</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-center">
                <p className="text-xl font-bold text-green-700">{stats.productionReady}</p>
                <p className="text-xs text-green-600">Ready</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg text-center">
                <p className="text-xl font-bold text-red-700">{stats.needsAttention}</p>
                <p className="text-xs text-red-600">Attention</p>
              </div>
            </div>
          </div>

          {/* Stage Progress */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Stage Progress</h3>
            <div className="space-y-2">
              {STAGE_ORDER.map(stage => {
                const count = stats.byStage[stage] || 0;
                const percentage = stats.totalItems > 0 ? (count / stats.totalItems) * 100 : 0;
                return (
                  <div key={stage} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-24 truncate">{STAGE_LABELS[stage]}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Items */}
        {stats.projectItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Recent Design Items</h3>
              <span className="text-xs text-gray-500">{stats.projectItems.length} items</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.projectItems.slice(0, 6).map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewItem(item)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 transition-colors group"
                >
                  <Package className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-xs text-gray-400">{item.itemCode}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {stats.projectItems.length > 6 && (
                <span className="px-3 py-1.5 text-sm text-gray-500">
                  +{stats.projectItems.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.projectItems.length === 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-center py-4">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No design items in this project yet</p>
          </div>
        )}

        {/* View Full Project Link */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link
            to={`/design/project/${project.id}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <FolderOpen className="w-4 h-4" />
            View Full Project
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ProjectDashboardCard;
