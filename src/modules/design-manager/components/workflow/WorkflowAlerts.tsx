/**
 * WorkflowAlerts Component
 * Contextual alerts with actionable remediation steps
 */

import { AlertTriangle, AlertCircle, Info, X, ArrowRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ValidationError } from '../../services/workflowStateService';

export type AlertType = 'error' | 'warning' | 'info' | 'success';

export interface WorkflowAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface WorkflowAlertsProps {
  alerts: WorkflowAlert[];
  onDismiss?: (alertId: string) => void;
  className?: string;
}

export function WorkflowAlerts({ alerts, onDismiss, className }: WorkflowAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {alerts.map(alert => (
        <WorkflowAlert
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

function WorkflowAlert({
  alert,
  onDismiss,
}: {
  alert: WorkflowAlert;
  onDismiss?: (alertId: string) => void;
}) {
  const getAlertStyles = (type: AlertType) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
    }
  };

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      case 'success':
        return <Info className="w-5 h-5" />;
    }
  };

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', getAlertStyles(alert.type))}>
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getAlertIcon(alert.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold mb-0.5">
          {alert.title}
        </h4>
        <p className="text-sm opacity-90">
          {alert.message}
        </p>

        {/* Action Button */}
        {alert.action && (
          <button
            onClick={alert.action.onClick}
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
              alert.type === 'error' && 'bg-red-600 text-white hover:bg-red-700',
              alert.type === 'warning' && 'bg-yellow-600 text-white hover:bg-yellow-700',
              alert.type === 'info' && 'bg-blue-600 text-white hover:bg-blue-700',
              alert.type === 'success' && 'bg-green-600 text-white hover:bg-green-700'
            )}
          >
            {alert.action.label}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {alert.dismissible && onDismiss && (
        <button
          onClick={() => onDismiss(alert.id)}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Convert validation errors to workflow alerts
 */
export function validationErrorsToAlerts(
  errors: ValidationError[],
  onItemClick?: (itemId: string, tab?: string) => void
): WorkflowAlert[] {
  return errors.map((error, index) => ({
    id: `error-${index}`,
    type: error.severity === 'error' ? 'error' : 'warning',
    title: error.itemName,
    message: `${error.issue}${error.action ? `. ${error.action}` : ''}`,
    action: error.itemId
      ? {
          label: `Fix ${error.itemName}`,
          onClick: () => onItemClick?.(error.itemId, error.tab),
        }
      : undefined,
    dismissible: error.severity === 'warning',
  }));
}

/**
 * Pre-built alert templates for common scenarios
 */
export const AlertTemplates = {
  missingCosting: (itemName: string, onFix: () => void): WorkflowAlert => ({
    id: `missing-costing-${itemName}`,
    type: 'error',
    title: 'Missing Costing Data',
    message: `${itemName} has no costing data. Click Auto Calculate and Save Costing in the Parts tab.`,
    action: {
      label: 'Go to Item',
      onClick: onFix,
    },
  }),

  optimizationStale: (itemCount: number, onRerun: () => void): WorkflowAlert => ({
    id: 'optimization-stale',
    type: 'warning',
    title: 'Optimization Needs Update',
    message: `${itemCount} item(s) were modified since last optimization. Re-run optimization for accurate estimates.`,
    action: {
      label: 'Run Optimization',
      onClick: onRerun,
    },
    dismissible: false,
  }),

  estimateStale: (onRegenerate: () => void): WorkflowAlert => ({
    id: 'estimate-stale',
    type: 'warning',
    title: 'Estimate Needs Regeneration',
    message: 'Item costs or optimization have changed. Regenerate estimate to use latest data.',
    action: {
      label: 'Regenerate Estimate',
      onClick: onRegenerate,
    },
    dismissible: false,
  }),

  materialPaletteUpdated: (onRecalculate: () => void): WorkflowAlert => ({
    id: 'material-palette-updated',
    type: 'info',
    title: 'Material Palette Updated',
    message: 'Material prices may have changed. Consider recalculating item costs.',
    action: {
      label: 'Recalculate Costs',
      onClick: onRecalculate,
    },
    dismissible: true,
  }),

  allComplete: (): WorkflowAlert => ({
    id: 'all-complete',
    type: 'success',
    title: 'Pricing Complete',
    message: 'All items are costed, optimization is up to date, and estimate is current.',
    dismissible: true,
  }),

  procurementMissing: (itemName: string, onFix: () => void): WorkflowAlert => ({
    id: `procurement-missing-${itemName}`,
    type: 'error',
    title: 'Missing Procurement Pricing',
    message: `${itemName} is a procured item but has no vendor pricing. Enter pricing in the Procurement tab.`,
    action: {
      label: 'Add Pricing',
      onClick: onFix,
    },
  }),

  designDocumentMissing: (itemName: string, onFix: () => void): WorkflowAlert => ({
    id: `design-doc-missing-${itemName}`,
    type: 'error',
    title: 'Missing Design Document Pricing',
    message: `${itemName} is a design document but has no hourly matrix. Enter hours in the Pricing tab.`,
    action: {
      label: 'Add Hours',
      onClick: onFix,
    },
  }),

  constructionMissing: (itemName: string, onFix: () => void): WorkflowAlert => ({
    id: `construction-missing-${itemName}`,
    type: 'error',
    title: 'Missing Construction Pricing',
    message: `${itemName} is a construction item but has no cost data. Enter costs in the Pricing tab.`,
    action: {
      label: 'Add Costs',
      onClick: onFix,
    },
  }),
};
