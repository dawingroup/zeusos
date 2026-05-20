/**
 * PartProcessingStatus — Validation summary for production readiness
 *
 * Lists parts with processability issues grouped by cabinet.
 */
import type { ScenePart } from '../../types/assembly.types';
import { bulkValidateParts } from '../../services/partProcessing.service';

interface PartProcessingStatusProps {
  partsByCabinet: Record<string, ScenePart[]>;
  cabinetNames: Record<string, string>;
}

export function PartProcessingStatus({ partsByCabinet, cabinetNames }: PartProcessingStatusProps) {
  const { ready, issuesByCabinet } = bulkValidateParts(partsByCabinet);

  if (ready) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        All parts are production-ready
      </div>
    );
  }

  const totalIssues = Object.values(issuesByCabinet).reduce((sum, issues) => sum + issues.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-amber-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="font-medium">{totalIssues} issue{totalIssues !== 1 ? 's' : ''} found</span>
      </div>

      {Object.entries(issuesByCabinet).map(([cabinetId, issues]) => (
        <div key={cabinetId} className="border rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">
            {cabinetNames[cabinetId] ?? cabinetId}
          </h4>
          <ul className="space-y-0.5">
            {issues.map((issue, i) => (
              <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">-</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
