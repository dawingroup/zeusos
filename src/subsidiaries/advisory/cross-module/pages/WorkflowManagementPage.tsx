import React, { useState } from 'react';
import {
  GitBranch,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Search,
  RefreshCw,
  ChevronRight,
  Building2,
  TrendingUp,
  Briefcase,
  Package
} from 'lucide-react';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { useWorkflow, useWorkflowList, useWorkflowTemplates } from '../hooks/useWorkflow';
import { WorkflowType, WorkflowStatus, ModuleType } from '../types/cross-module';

interface WorkflowManagementPageProps {
  userId: string;
}

const STATUS_TABS: { value: WorkflowStatus | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <GitBranch className="w-4 h-4" /> },
  { value: 'in_progress', label: 'In Progress', icon: <Clock className="w-4 h-4" /> },
  { value: 'completed', label: 'Completed', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'failed', label: 'Failed', icon: <AlertCircle className="w-4 h-4" /> },
  { value: 'cancelled', label: 'Cancelled', icon: <XCircle className="w-4 h-4" /> }
];

const MODULE_ICONS: Record<ModuleType, React.ReactNode> = {
  infrastructure: <Building2 className="w-4 h-4" />,
  investment: <TrendingUp className="w-4 h-4" />,
  advisory: <Briefcase className="w-4 h-4" />,
  matflow: <Package className="w-4 h-4" />
};

export const WorkflowManagementPage: React.FC<WorkflowManagementPageProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<WorkflowStatus | 'all'>('in_progress');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [startingWorkflow, setStartingWorkflow] = useState<WorkflowType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { workflows, loading, refresh, startWorkflow } = useWorkflowList(
    activeTab === 'all' ? undefined : activeTab
  );
  const { templates } = useWorkflowTemplates();
  const {
    workflow: selectedWorkflow,
    approveStep,
    cancelWorkflow,
    retryWorkflow
  } = useWorkflow(selectedWorkflowId);

  const handleStartWorkflow = async (type: WorkflowType, inputs: Record<string, unknown> = {}) => {
    setStartingWorkflow(type);
    try {
      const newWorkflow = await startWorkflow(type, inputs, userId);
      setSelectedWorkflowId(newWorkflow.id);
      setShowTemplates(false);
    } finally {
      setStartingWorkflow(null);
    }
  };

  const filteredWorkflows = workflows.filter(
    w => w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: WorkflowStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Management</h1>
            <p className="text-gray-500 mt-1">
              Orchestrate cross-module workflows and track progress
            </p>
          </div>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Workflow
          </button>
        </div>

        {/* Workflow Templates Modal */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">Start a New Workflow</h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="grid gap-4">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className="p-4 border rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                          <div className="flex items-center gap-4 mt-3">
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {template.estimatedDuration}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <CheckCircle className="w-3 h-3" />
                              {template.steps.length} steps
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {template.steps.slice(0, 4).map((step, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                              >
                                {MODULE_ICONS[step.module]}
                                {step.name}
                              </span>
                            ))}
                            {template.steps.length > 4 && (
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
                                +{template.steps.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartWorkflow(template.type)}
                          disabled={startingWorkflow === template.type}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workflow List */}
          <div className="lg:col-span-1">
            {/* Status Tabs */}
            <div className="bg-white rounded-xl border mb-4">
              <div className="flex overflow-x-auto">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.value
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search workflows..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => refresh()}
                className="p-2 border rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Workflow List */}
            <div className="bg-white rounded-xl border divide-y max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : filteredWorkflows.length > 0 ? (
                filteredWorkflows.map(workflow => (
                  <button
                    key={workflow.id}
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedWorkflowId === workflow.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {workflow.name}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(workflow.status)}`}>
                        {workflow.status.replace('_', ' ')}
                      </span>
                      <span className="text-gray-400">
                        {workflow.steps.filter(s => s.status === 'completed').length}/
                        {workflow.steps.length} steps
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Started {workflow.startedAt.toDate().toLocaleDateString()}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center">
                  <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No workflows found</p>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Detail */}
          <div className="lg:col-span-2">
            {selectedWorkflow ? (
              <WorkflowProgress
                workflow={selectedWorkflow}
                onApproveStep={stepId => approveStep(stepId, userId)}
                onCancel={cancelWorkflow}
                onRetry={retryWorkflow}
              />
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <GitBranch className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Workflow
                </h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Choose a workflow from the list to view its progress and manage steps
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowManagementPage;
