import React, { useState } from 'react';
import {
  Link2,
  Search,
  FileText,
  GitBranch,
  ArrowRight,
  Building2,
  TrendingUp,
  Briefcase,
  Package,
  Activity,
  Clock,
  CheckCircle,
  Play
} from 'lucide-react';
import { UnifiedSearchBar } from '../components/UnifiedSearchBar';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { useWorkflowList, useWorkflowTemplates } from '../hooks/useWorkflow';
import { EntityReference, ModuleType, WorkflowType } from '../types/cross-module';

interface CrossModuleDashboardProps {
  userId: string;
  onNavigate?: (path: string) => void;
}

const MODULE_CONFIG: Record<ModuleType, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  infrastructure: {
    icon: <Building2 className="w-5 h-5" />,
    label: 'Infrastructure',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  investment: {
    icon: <TrendingUp className="w-5 h-5" />,
    label: 'Investment',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  advisory: {
    icon: <Briefcase className="w-5 h-5" />,
    label: 'Advisory',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  matflow: {
    icon: <Package className="w-5 h-5" />,
    label: 'MatFlow',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  }
};

export const CrossModuleDashboard: React.FC<CrossModuleDashboardProps> = ({
  userId,
  onNavigate
}) => {
  const { workflows, loading: workflowsLoading, startWorkflow } = useWorkflowList('in_progress');
  const { templates } = useWorkflowTemplates();
  const [startingWorkflow, setStartingWorkflow] = useState<WorkflowType | null>(null);

  const handleResultSelect = (entity: EntityReference) => {
    onNavigate?.(`/${entity.module}/${entity.type}/${entity.id}`);
  };

  const handleStartWorkflow = async (type: WorkflowType) => {
    setStartingWorkflow(type);
    try {
      await startWorkflow(type, {}, userId);
    } finally {
      setStartingWorkflow(null);
    }
  };

  const quickActions = [
    {
      icon: <Search className="w-5 h-5" />,
      label: 'Unified Search',
      description: 'Search across all modules',
      path: '/cross-module/search',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: <Link2 className="w-5 h-5" />,
      label: 'Entity Links',
      description: 'Manage entity relationships',
      path: '/cross-module/links',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: 'Reports',
      description: 'Generate cross-module reports',
      path: '/cross-module/reports',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: <GitBranch className="w-5 h-5" />,
      label: 'Workflows',
      description: 'Manage automated workflows',
      path: '/cross-module/workflows',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cross-Module Hub</h1>
          <p className="text-gray-500 mt-1">
            Connect, search, and orchestrate across Infrastructure, Investment, Advisory, and MatFlow
          </p>
        </div>

        {/* Unified Search */}
        <div className="mb-8">
          <UnifiedSearchBar
            userId={userId}
            onResultSelect={handleResultSelect}
            placeholder="Search projects, deals, engagements, materials..."
            className="max-w-2xl"
          />
        </div>

        {/* Module Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {(Object.entries(MODULE_CONFIG) as [ModuleType, typeof MODULE_CONFIG[ModuleType]][]).map(
            ([module, config]) => (
              <button
                key={module}
                onClick={() => onNavigate?.(`/${module}`)}
                className={`p-4 rounded-xl ${config.bgColor} border border-transparent hover:border-gray-200 hover:shadow-md transition-all group text-left`}
              >
                <div className={`${config.color} mb-2`}>{config.icon}</div>
                <div className="font-medium text-gray-900">{config.label}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  View module
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            )
          )}
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => onNavigate?.(action.path)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${action.bgColor} ${action.color}`}>
                  {action.icon}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="font-medium text-gray-900">{action.label}</div>
              <div className="text-sm text-gray-500 mt-1">{action.description}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Workflows */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Workflows</h2>
              <button
                onClick={() => onNavigate?.('/cross-module/workflows')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {workflowsLoading ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : workflows.length > 0 ? (
              <div className="space-y-4">
                {workflows.slice(0, 2).map(workflow => (
                  <WorkflowProgress
                    key={workflow.id}
                    workflow={workflow}
                    onApproveStep={(stepId) => console.log('Approve step:', stepId)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-8 text-center">
                <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No active workflows</p>
                <p className="text-sm text-gray-400 mt-1">Start a workflow from the templates below</p>
              </div>
            )}
          </div>

          {/* Workflow Templates */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Start a Workflow</h2>
            <div className="bg-white rounded-xl border divide-y">
              {templates.slice(0, 4).map(template => (
                <div key={template.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.estimatedDuration}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {template.steps.length} steps
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartWorkflow(template.type)}
                      disabled={startingWorkflow === template.type}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {startingWorkflow === template.type ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cross-Module Activity</h2>
          <div className="bg-white rounded-xl border">
            <div className="p-6 text-center text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Cross-module activity will appear here</p>
              <p className="text-sm text-gray-400 mt-1">
                Links created, workflows completed, and reports generated
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrossModuleDashboard;
