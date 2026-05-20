/**
 * Stage Gate Check Component
 * Modal for validating stage transitions
 */

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { DesignItem, DesignStage } from '../../types';
import type { ConstructionOrder } from '@/modules/construction/types';
import { canAdvanceToStage, getNextStageForItem } from '../../utils/stage-gate';
import { calculateOverallReadiness } from '../../utils/rag-calculations';
import { STAGE_LABELS } from '../../utils/formatting';
import { StageBadge } from '../design-item/StageBadge';
import { ReadinessGauge } from '../design-item/ReadinessGauge';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Lock } from 'lucide-react';

export interface StageGateCheckProps {
  item: DesignItem;
  targetStage?: DesignStage;
  onAdvance?: (item: DesignItem, targetStage: DesignStage, overrideNote?: string) => void;
  onCancel?: () => void;
  allowOverride?: boolean;
  className?: string;
  /** Linked Construction Order for construction-gate evaluation. */
  constructionOrder?: ConstructionOrder | null;
}

interface CriterionRowProps {
  label: string;
  passed: boolean;
  isWarning?: boolean;
}

function CriterionRow({ label, passed, isWarning = false }: CriterionRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {passed ? (
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : isWarning ? (
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      )}
      <span className={cn(
        'text-sm',
        passed ? 'text-gray-700' : isWarning ? 'text-amber-700' : 'text-red-700'
      )}>
        {label}
      </span>
    </div>
  );
}

export function StageGateCheck({ 
  item, 
  targetStage,
  onAdvance,
  onCancel,
  allowOverride = false,
  className,
  constructionOrder,
}: StageGateCheckProps) {
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const computedReadiness = calculateOverallReadiness(item.ragStatus);

  const nextStage = targetStage || getNextStageForItem(item);
  
  if (!nextStage) {
    const finalLabel = item.sourcingType === 'PROCURED' ? 'Procurement Received' : 'Production Ready';
    return (
      <div className={cn('bg-white rounded-lg p-6', className)}>
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900">{finalLabel}</h3>
          <p className="text-gray-600 mt-1">This item has reached the final stage.</p>
        </div>
      </div>
    );
  }

  const gateCheck = canAdvanceToStage(item, nextStage, {
    approvals: item.approvals,
    constructionOrder: constructionOrder ?? null,
  });
  const canProceed = gateCheck.canAdvance || (allowOverride && showOverride && overrideNote.trim().length > 10);

  return (
    <div className={cn('bg-white rounded-lg', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Stage Gate Check
        </h3>
        <div className="flex items-center gap-2">
          <StageBadge stage={item.currentStage} size="sm" />
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <StageBadge stage={nextStage} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Readiness Check */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900">Overall Readiness</p>
            <p className="text-xs text-gray-500">
              {computedReadiness}% complete
            </p>
          </div>
          <ReadinessGauge value={computedReadiness} size="md" />
        </div>

        {/* Must-Meet Criteria */}
        {gateCheck.failures.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" />
              Required Criteria
            </h4>
            <div className="bg-red-50 rounded-lg p-3">
              {gateCheck.failures.map((failure, index) => (
                <CriterionRow key={index} label={failure} passed={false} />
              ))}
            </div>
          </div>
        )}

        {/* All Passed */}
        {gateCheck.failures.length === 0 && (
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">
                All required criteria met
              </span>
            </div>
          </div>
        )}

        {/* Should-Meet Criteria (Warnings) */}
        {gateCheck.warnings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Recommendations
            </h4>
            <div className="bg-amber-50 rounded-lg p-3">
              {gateCheck.warnings.map((warning, index) => (
                <CriterionRow key={index} label={warning} passed={false} isWarning />
              ))}
            </div>
          </div>
        )}

        {/* Override Option */}
        {allowOverride && !gateCheck.canAdvance && (
          <div className="border-t border-gray-200 pt-4">
            {!showOverride ? (
              <button
                onClick={() => setShowOverride(true)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Override gate check (admin only)
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Override Justification (required, min 10 characters)
                </label>
                <textarea
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                  placeholder="Explain why this gate check is being overridden..."
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => onAdvance?.(item, nextStage, showOverride ? overrideNote : undefined)}
          disabled={!canProceed}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2',
            canProceed
              ? 'bg-[#872E5C] text-white hover:bg-[#6a2449]'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          )}
        >
          Advance to {STAGE_LABELS[nextStage]}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default StageGateCheck;
