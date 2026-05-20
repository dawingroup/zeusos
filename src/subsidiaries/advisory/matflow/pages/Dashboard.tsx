/**
 * MatFlow Dashboard
 * Overview page for MatFlow module - relies on MatFlowLayout for navigation
 * Styled to match Finishes Design Manager patterns
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HardHat,
  ClipboardList,
  Package,
  TrendingUp,
  Plus,
  ChevronRight,
  FolderOpen,
  Calculator,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useMatFlowProjects } from '../hooks/useMatFlow';
import { ColoredStatsCard, type StatsCardColor } from '@/shared/components/data-display';
import { BaseCard, InteractiveCard } from '@/shared/components/cards';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, isLoading } = useMatFlowProjects();

  // Stats data matching Finishes pattern
  const stats: Array<{
    label: string;
    value: string;
    subtitle: string;
    icon: typeof HardHat;
    color: StatsCardColor;
  }> = [
    {
      label: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length.toString(),
      subtitle: 'In progress',
      icon: HardHat,
      color: 'blue',
    },
    {
      label: 'BOQ Items',
      value: '0',
      subtitle: 'Across all projects',
      icon: ClipboardList,
      color: 'amber',
    },
    {
      label: 'Deliveries',
      value: '0',
      subtitle: 'This month',
      icon: Package,
      color: 'green',
    },
    {
      label: 'Total Value',
      value: 'UGX 0',
      subtitle: 'Project budgets',
      icon: TrendingUp,
      color: 'purple',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'on-hold': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Quick actions for navigation
  const quickActions = [
    {
      label: 'Projects',
      description: 'Manage all projects',
      icon: FolderOpen,
      path: '/advisory/matflow/projects',
      color: 'amber'
    },
    {
      label: 'BOQ',
      description: 'Bills of quantities',
      icon: ClipboardList,
      path: '/advisory/matflow/boq',
      color: 'blue'
    },
    {
      label: 'Formulas',
      description: 'Material calculations',
      icon: Calculator,
      path: '/advisory/matflow/formulas',
      color: 'green'
    },
    {
      label: 'Procurement',
      description: 'Purchase orders',
      icon: ShoppingCart,
      path: '/advisory/matflow/procurement',
      color: 'purple'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MatFlow Overview</h1>
          <p className="text-muted-foreground">Material flow & project tracking dashboard</p>
        </div>
        <Link
          to="/advisory/matflow/projects/new"
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Stats Grid - Using ColoredStatsCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <ColoredStatsCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            subtitle={stat.subtitle}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Quick Actions Grid */}
      <BaseCard>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <InteractiveCard
                key={action.label}
                to={action.path}
                padding="sm"
                hoverBorderColor="hover:border-amber-200"
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{action.label}</p>
                  <p className="text-xs text-gray-500 truncate">{action.description}</p>
                </div>
              </InteractiveCard>
            );
          })}
        </div>
      </BaseCard>

      {/* Recent Projects Section */}
      <BaseCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Recent Projects</h2>
          <Link
            to="/advisory/matflow/projects"
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8">
            <HardHat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No projects yet</h3>
            <p className="text-gray-500 mb-4">Create your first project to get started</p>
            <Link
              to="/advisory/matflow/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.slice(0, 5).map((project) => (
              <InteractiveCard
                key={project.id}
                onClick={() => navigate(`/advisory/matflow/projects/${project.id}`)}
                padding="sm"
                hoverBorderColor="hover:border-amber-200"
                className="flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HardHat className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{project.name}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(project.status))}>
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {project.location?.district || 'No location specified'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </InteractiveCard>
            ))}
          </div>
        )}
      </BaseCard>
    </div>
  );
};

export default Dashboard;
