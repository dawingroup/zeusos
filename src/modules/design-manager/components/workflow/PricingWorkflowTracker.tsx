/**
 * PricingWorkflowTracker Component
 * Visual progress indicator for pricing and estimation workflow
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Circle, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PricingWorkflowState, WorkflowStepStatus } from '../../services/workflowStateService';
import {
  getWorkflowProgress,
  getStepDisplayInfo,
  getNextAction,
} from '../../services/workflowStateService';

interface PricingWorkflowTrackerProps {
  workflowState: PricingWorkflowState;
  onNavigate?: (tab: string) => void;
  onBatchRecalculate?: () => Promise<void>;
  className?: string;
}

export function PricingWorkflowTracker({
  workflowState,
  onNavigate,
  onBatchRecalculate,
  className,
}: PricingWorkflowTrackerProps) {
  const [expanded, setExpanded] = useState(false);
  const [batchRecalculating, setBatchRecalculating] = useState(false);
  const progress = getWorkflowProgress(workflowState);
  const nextAction = getNextAction(workflowState);

  const errorCount = workflowState.validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = workflowState.validationErrors.filter(e => e.severity === 'warning').length;

  // Auto-collapse if complete with no errors
  useEffect(() => {
    if (workflowState.currentStep === 'complete' && errorCount === 0 && warningCount === 0) {
      setExpanded(false);
    }
  }, [workflowState.currentStep, errorCount, warningCount]);

  const getStatusColor = (status: WorkflowStepStatus) => {
    switch (status) {
      case 'complete':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'in-progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'stale':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'not-started':
        return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: WorkflowStepStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5" />;
      case 'in-progress':
        return <Clock className="w-5 h-5" />;
      case 'stale':
        return <AlertTriangle className="w-5 h-5" />;
      case 'not-started':
        return <Circle className="w-5 h-5" />;
    }
  };

  const steps = [
    {
      id: 'itemCosting',
      label: 'Item Costing',
      status: workflowState.steps.itemCosting.status,
      detail: `${workflowState.steps.itemCosting.completedItems.length} of ${workflowState.steps.itemCosting.totalItems} items`,
      tab: 'items',
    },
    {
      id: 'optimization',
      label: 'Optimization',
      status: workflowState.steps.optimization.status,
      detail: workflowState.steps.optimization.lastRun
        ? 'Last run: ' + new Date(workflowState.steps.optimization.lastRun.seconds * 1000).toLocaleTimeString()
        : 'Not run',
      tab: 'production',
    },
    {
      id: 'estimateGeneration',
      label: 'Estimate',
      status: workflowState.steps.estimateGeneration.status,
      detail: workflowState.steps.estimateGeneration.lastGenerated
        ? 'Last generated: ' + new Date(workflowState.steps.estimateGeneration.lastGenerated.seconds * 1000).toLocaleTimeString()
        : 'Not generated',
      tab: 'estimate',
    },
  ];

  return (
    <div className={cn('bg-white border-b border-gray-200 shadow-sm', className)}>
      {/* Compact Progress Bar */}
      <div
        className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Progress Icon */}
            <div className="flex-shrink-0">
              {workflowState.currentStep === 'complete' && errorCount === 0 ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : errorCount > 0 ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : warningCount > 0 ? (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              ) : (
                <Clock className="w-6 h-6 text-blue-600" />
              )}
            </div>

            {/* Progress Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Pricing Workflow
                </h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {progress}% Complete
                </span>
              </div>
              <p className="text-xs text-gray-600 truncate">
                {workflowState.suggestedAction}
              </p>
            </div>

            {/* Status Badges */}
            <div className="hidden md:flex items-center gap-2">
              {steps.map((step) => {
                const displayInfo = getStepDisplayInfo(step.status);
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-medium border',
                      getStatusColor(step.status)
                    )}
                  >
                    {displayInfo.icon} {step.label}
                  </div>
                );
              })}
            </div>

            {/* Error/Warning Count */}
            {(errorCount > 0 || warningCount > 0) && (
              <div className="flex items-center gap-2 text-xs">
                {errorCount > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md font-medium">
                    {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md font-medium">
                    {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                  </span>
                )}
              </div>
            )}

            {/* Expand/Collapse Icon */}
            <ChevronRight
              className={cn(
                'w-5 h-5 text-gray-400 transition-transform',
                expanded && 'rotate-90'
              )}
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              errorCount > 0 ? 'bg-red-600' : warningCount > 0 ? 'bg-yellow-600' : 'bg-green-600'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          {/* Step Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {steps.map((step, index) => {
              const isActive = workflowState.currentStep === step.id.replace(/([A-Z])/g, '-$1').toLowerCase();

              return (
                <div
                  key={step.id}
                  className={cn(
                    'relative p-3 rounded-lg border-2 transition-all',
                    getStatusColor(step.status),
                    isActive && 'ring-2 ring-blue-400',
                    onNavigate && 'cursor-pointer hover:shadow-md'
                  )}
                  onClick={() => onNavigate?.(step.tab)}
                >
                  {/* Step Number */}
                  <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white border-2 border-current flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>

                  {/* Step Content */}
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(step.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold">
                        {step.label}
                      </h4>
                      <p className="text-xs mt-0.5 opacity-75">
                        {step.detail}
                      </p>
                      {isActive && (
                        <p className="text-xs mt-1 font-medium">
                          → {nextAction.action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Batch Recalculate Action */}
          {onBatchRecalculate && workflowState.steps.itemCosting.status !== 'complete' && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={async () => {
                  setBatchRecalculating(true);
                  try {
                    await onBatchRecalculate();
                  } finally {
                    setBatchRecalculating(false);
                  }
                }}
                disabled={batchRecalculating}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', batchRecalculating && 'animate-spin')} />
                {batchRecalculating ? 'Recalculating...' : 'Recalculate All Items'}
              </button>
              {batchRecalculating && (
                <span className="text-xs text-gray-500">Updating manufacturing costs from parts...</span>
              )}
            </div>
          )}

          {/* Validation Errors */}
          {workflowState.validationErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Issues Requiring Attention
              </h4>
              <div className="space-y-1">
                {workflowState.validationErrors.slice(0, 5).map((error, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded-md text-xs',
                      error.severity === 'error'
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    )}
                  >
                    {error.severity === 'error' ? (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <span className="font-medium">
                        {error.itemName}
                      </span>
                      {': '}
                      {error.issue}
                      {error.action && (
                        <span className="block mt-0.5 text-xs opacity-75">
                          → {error.action}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {workflowState.validationErrors.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    + {workflowState.validationErrors.length - 5} more issues
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {workflowState.currentStep === 'complete' && workflowState.validationErrors.length === 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <p className="text-sm font-medium">
                  All done! Your estimate is up to date and ready to use.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
