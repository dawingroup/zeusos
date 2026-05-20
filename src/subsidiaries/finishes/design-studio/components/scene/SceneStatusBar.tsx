/**
 * SceneStatusBar — Bottom bar with scene summary metrics
 *
 * Shows: total cabinets, total parts, total value, scene status.
 */
import type { DesignScene } from '../../types/scene.types';

interface SceneStatusBarProps {
  scene: DesignScene;
  totalParts?: number;
  validationIssueCount?: number;
  onIssuesClick?: () => void;
  autoSyncSyncingCount?: number;
  autoSyncErrorCount?: number;
  autoSyncLastAt?: Date;
  autoSyncLastSyncedParts?: number;
  onAutoSyncErrorsClick?: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  in_production: 'In Production',
  archived: 'Archived',
};

export function SceneStatusBar({
  scene,
  totalParts,
  validationIssueCount,
  onIssuesClick,
  autoSyncSyncingCount,
  autoSyncErrorCount,
  autoSyncLastAt,
  autoSyncLastSyncedParts,
  onAutoSyncErrorsClick,
}: SceneStatusBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {scene.totalCabinetCount} cabinet{scene.totalCabinetCount !== 1 ? 's' : ''}
        </span>
        {totalParts !== undefined && (
          <span>{totalParts} parts</span>
        )}
        {scene.totalEstimatedValue > 0 && (
          <span className="font-medium text-gray-700">
            {formatCurrency(scene.totalEstimatedValue, scene.currency)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {autoSyncSyncingCount !== undefined && autoSyncSyncingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-blue-700">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8m8 8a8 8 0 01-8 8" />
            </svg>
            Auto-syncing {autoSyncSyncingCount}
          </span>
        )}
        {autoSyncErrorCount !== undefined && autoSyncErrorCount > 0 && (
          <button
            type="button"
            onClick={onAutoSyncErrorsClick}
            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
            title={`${autoSyncErrorCount} DesignItem sync failures`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Auto-sync errors: {autoSyncErrorCount}
          </button>
        )}
        {autoSyncLastAt && (
          <span className="text-emerald-700" title={`Last auto-sync at ${autoSyncLastAt.toLocaleString()}`}>
            Auto-sync: {autoSyncLastSyncedParts ?? 0} parts
          </span>
        )}
        {validationIssueCount !== undefined && validationIssueCount > 0 && (
          <button
            type="button"
            onClick={onIssuesClick}
            className="flex items-center gap-1 text-amber-600 hover:text-amber-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {validationIssueCount} issue{validationIssueCount !== 1 ? 's' : ''}
          </button>
        )}
        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">
          {STATUS_LABEL[scene.status] ?? scene.status}
        </span>
      </div>
    </div>
  );
}
