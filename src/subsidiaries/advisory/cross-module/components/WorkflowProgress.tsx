import React from 'react';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Ban
} from 'lucide-react';
import { Workflow, StepStatus } from '../types/cross-module';

interface WorkflowProgressProps {
  workflow: Workflow;
  onApproveStep?: (stepId: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
}

const STEP_STATUS_ICONS: Record<StepStatus, React.ReactNode> = {
  pending: <Circle className="w-5 h-5 text-gray-400" />,
  in_progress: <Clock className="w-5 h-5 text-blue-500 animate-pulse" />,
  completed: <CheckCircle className="w-5 h-5 text-green-500" />,
  failed: <AlertCircle className="w-5 h-5 text-red-500" />,
  skipped: <XCircle className="w-5 h-5 text-gray-400" />
};

const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'border-gray-200 bg-gray-50',
  in_progress: 'border-blue-200 bg-blue-50',
  completed: 'border-green-200 bg-green-50',
  failed: 'border-red-200 bg-red-50',
  skipped: 'border-gray-200 bg-gray-100'
};

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  workflow,
  onApproveStep,
  onRetry,
  onCancel
}) => {
  const getStepProgress = () => {
    const completed = workflow.steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / workflow.steps.length) * 100);
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Started {workflow.startedAt.toDate().toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {workflow.status === 'failed' && onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}
            {workflow.status === 'in_progress' && onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center gap-1"
              >
                <Ban className="w-4 h-4" />
                Cancel
              </button>
            )}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                workflow.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : workflow.status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : workflow.status === 'cancelled'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {workflow.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{getStepProgress()}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                workflow.status === 'failed' ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${getStepProgress()}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          {workflow.steps.map((step, index) => (
            <div key={step.id} className="relative">
              {index < workflow.steps.length - 1 && (
                <div
                  className={`absolute left-[22px] top-12 w-0.5 h-8 ${
                    step.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                  }`}
                />
              )}

              <div className={`p-3 rounded-lg border ${STEP_STATUS_COLORS[step.status]}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{STEP_STATUS_ICONS[step.status]}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{step.name}</div>
                      <span className="text-xs text-gray-500 capitalize">{step.module}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>

                    {step.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-600">
                        {step.error}
                      </div>
                    )}

                    {step.requiresApproval &&
                      step.status === 'pending' &&
                      !step.approvedBy &&
                      step.dependencies.every(d =>
                        workflow.steps.find(s => s.id === d)?.status === 'completed'
                      ) && (
                        <button
                          onClick={() => onApproveStep?.(step.id)}
                          className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve & Continue
                        </button>
                      )}

                    {step.completedAt && (
                      <div className="mt-2 text-xs text-gray-400">
                        Completed: {step.completedAt.toDate().toLocaleString()}
                      </div>
                    )}
                    {step.approvedBy && (
                      <div className="mt-1 text-xs text-gray-400">
                        Approved by: {step.approvedBy}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowProgress;
