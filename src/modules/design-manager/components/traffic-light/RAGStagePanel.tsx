/**
 * RAG Stage Panel Component
 * Shows RAG aspects grouped by stage transition requirements
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Circle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { RAGStatus, RAGValue, DesignStage } from '../../types';
import { RAGIndicator } from './RAGIndicator';
import {
  MANUFACTURING_STAGE_ORDER,
  PROCUREMENT_STAGE_ORDER,
  GATE_CRITERIA,
  isProcurementStage,
} from '../../utils/stage-gate';
import { STAGE_LABELS as STAGE_LABELS_FORMAT } from '../../utils/formatting';

export interface RAGStagePanelProps {
  ragStatus: RAGStatus;
  currentStage: DesignStage;
  editable?: boolean;
  onAspectClick?: (category: keyof RAGStatus, aspect: string, value: RAGValue) => void;
  className?: string;
}

// Aspect metadata for display
const ASPECT_META: Record<string, { label: string; category: keyof RAGStatus }> = {
  'designCompleteness.overallDimensions': { label: 'Overall Dimensions', category: 'designCompleteness' },
  'designCompleteness.model3D': { label: '3D Model', category: 'designCompleteness' },
  'designCompleteness.productionDrawings': { label: 'Production Drawings', category: 'designCompleteness' },
  'designCompleteness.materialSpecs': { label: 'Material Specs', category: 'designCompleteness' },
  'designCompleteness.hardwareSpecs': { label: 'Hardware Specs', category: 'designCompleteness' },
  'designCompleteness.finishSpecs': { label: 'Finish Specs', category: 'designCompleteness' },
  'designCompleteness.joineryDetails': { label: 'Joinery Details', category: 'designCompleteness' },
  'designCompleteness.tolerances': { label: 'Tolerances', category: 'designCompleteness' },
  'designCompleteness.assemblyInstructions': { label: 'Assembly Instructions', category: 'designCompleteness' },
  'manufacturingReadiness.materialAvailability': { label: 'Material Availability', category: 'manufacturingReadiness' },
  'manufacturingReadiness.hardwareAvailability': { label: 'Hardware Availability', category: 'manufacturingReadiness' },
  'manufacturingReadiness.toolingReadiness': { label: 'Tooling Readiness', category: 'manufacturingReadiness' },
  'manufacturingReadiness.processDocumentation': { label: 'Process Documentation', category: 'manufacturingReadiness' },
  'manufacturingReadiness.qualityCriteria': { label: 'Quality Criteria', category: 'manufacturingReadiness' },
  'manufacturingReadiness.costValidation': { label: 'Cost Validation', category: 'manufacturingReadiness' },
  'qualityGates.internalDesignReview': { label: 'Internal Design Review', category: 'qualityGates' },
  'qualityGates.manufacturingReview': { label: 'Manufacturing Review', category: 'qualityGates' },
  'qualityGates.clientApproval': { label: 'Client Approval', category: 'qualityGates' },
  'qualityGates.prototypeValidation': { label: 'Prototype Validation', category: 'qualityGates' },
};

// Get aspect value from ragStatus by path
function getAspectValue(ragStatus: RAGStatus, path: string): RAGValue | null {
  const [category, key] = path.split('.') as [keyof RAGStatus, string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categoryData = ragStatus[category] as any;
  return categoryData?.[key] || null;
}

// Check if an aspect meets the required status
function meetsRequirement(value: RAGValue | null, required: string | string[]): boolean {
  if (!value) return false;
  const requiredArray = Array.isArray(required) ? required : [required];
  return requiredArray.includes(value.status) || value.status === 'not-applicable';
}

interface StageRequirementsProps {
  stage: DesignStage;
  ragStatus: RAGStatus;
  isCurrentStage: boolean;
  isNextStage: boolean;
  isPastStage: boolean;
  editable?: boolean;
  onAspectClick?: (category: keyof RAGStatus, aspect: string, value: RAGValue) => void;
}

function StageRequirements({
  stage,
  ragStatus,
  isCurrentStage,
  isNextStage,
  isPastStage,
  editable,
  onAspectClick,
}: StageRequirementsProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentStage || isNextStage);
  const criteria = GATE_CRITERIA[stage];
  
  // Calculate completion for this stage
  const mustMeetAspects = criteria.mustMeet.filter(c => c.aspect !== 'ALL');
  const shouldMeetAspects = criteria.shouldMeet;
  const allAspects = [...mustMeetAspects, ...shouldMeetAspects];

  if (allAspects.length === 0) {
    return null;
  }
  
  const completedMust = mustMeetAspects.filter(c => {
    const value = getAspectValue(ragStatus, c.aspect);
    return meetsRequirement(value, c.requiredStatus);
  }).length;
  
  const completedShould = shouldMeetAspects.filter(c => {
    const value = getAspectValue(ragStatus, c.aspect);
    return meetsRequirement(value, c.requiredStatus);
  }).length;
  
  const totalMust = mustMeetAspects.length;
  const totalShould = shouldMeetAspects.length;
  const allMustComplete = completedMust === totalMust;
  const allComplete = allMustComplete && completedShould === totalShould;
  
  // For production-ready, check if ALL aspects are green
  const isProductionReady = stage === 'production-ready';
  
  return (
    <div className={cn(
      'border rounded-lg overflow-hidden',
      isNextStage ? 'border-[#1d1d1f] ring-2 ring-[#1d1d1f]/20' :
      isPastStage ? 'border-green-200 bg-green-50/50' :
      'border-gray-200'
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-3 text-left',
          isNextStage ? 'bg-[#1d1d1f]/5' :
          isPastStage ? 'bg-green-50' :
          'bg-gray-50'
        )}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className={cn(
            'font-medium',
            isNextStage ? 'text-[#1d1d1f]' :
            isPastStage ? 'text-green-700' :
            'text-gray-700'
          )}>
            {STAGE_LABELS_FORMAT[stage]}
          </span>
          {isCurrentStage && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Current
            </span>
          )}
          {isNextStage && (
            <span className="text-xs bg-[#1d1d1f]/10 text-[#1d1d1f] px-2 py-0.5 rounded-full">
              Next
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isPastStage || allComplete ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : allMustComplete ? (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{completedShould}/{totalShould} optional</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-500">
              <Circle className="w-4 h-4" />
              <span className="text-xs">{completedMust}/{totalMust} required</span>
            </div>
          )}
        </div>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {isProductionReady ? (
            <div className="text-sm text-gray-600">
              All aspects must be <span className="text-green-600 font-medium">Green</span> to release to production.
              <br />
              <span className="text-gray-500">Minimum readiness: {criteria.minimumReadiness}%</span>
            </div>
          ) : (
            <>
              {/* Must Meet */}
              {mustMeetAspects.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Required ({completedMust}/{totalMust})
                  </h4>
                  <div className="space-y-1">
                    {mustMeetAspects.map((criterion) => {
                      const meta = ASPECT_META[criterion.aspect];
                      const value = getAspectValue(ragStatus, criterion.aspect);
                      const isMet = meetsRequirement(value, criterion.requiredStatus);
                      const aspectKey = criterion.aspect.split('.')[1];
                      
                      return (
                        <div
                          key={criterion.aspect}
                          className={cn(
                            'flex items-center gap-3 py-2 px-2 rounded-md',
                            editable && 'hover:bg-gray-50 cursor-pointer',
                            isMet && 'bg-green-50/50'
                          )}
                          onClick={() => {
                            if (editable && value && meta) {
                              onAspectClick?.(meta.category, aspectKey, value);
                            }
                          }}
                        >
                          <RAGIndicator status={value?.status || 'red'} size="sm" />
                          <span className={cn(
                            'text-sm flex-1',
                            isMet ? 'text-green-700' : 'text-gray-700'
                          )}>
                            {meta?.label || criterion.aspect}
                          </span>
                          {isMet ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <span className="text-xs text-gray-400">
                              Need: {Array.isArray(criterion.requiredStatus) 
                                ? criterion.requiredStatus.join('/') 
                                : criterion.requiredStatus}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Should Meet */}
              {shouldMeetAspects.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Recommended ({completedShould}/{totalShould})
                  </h4>
                  <div className="space-y-1">
                    {shouldMeetAspects.map((criterion) => {
                      const meta = ASPECT_META[criterion.aspect];
                      const value = getAspectValue(ragStatus, criterion.aspect);
                      const isMet = meetsRequirement(value, criterion.requiredStatus);
                      const aspectKey = criterion.aspect.split('.')[1];
                      
                      return (
                        <div
                          key={criterion.aspect}
                          className={cn(
                            'flex items-center gap-3 py-2 px-2 rounded-md',
                            editable && 'hover:bg-gray-50 cursor-pointer',
                            isMet && 'bg-green-50/50'
                          )}
                          onClick={() => {
                            if (editable && value && meta) {
                              onAspectClick?.(meta.category, aspectKey, value);
                            }
                          }}
                        >
                          <RAGIndicator status={value?.status || 'red'} size="sm" />
                          <span className={cn(
                            'text-sm flex-1',
                            isMet ? 'text-green-700' : 'text-gray-700'
                          )}>
                            {meta?.label || criterion.aspect}
                          </span>
                          {isMet && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Minimum Readiness */}
              {criteria.minimumReadiness > 0 && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                  Minimum overall readiness: {criteria.minimumReadiness}%
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RAGStagePanel({
  ragStatus,
  currentStage,
  editable = false,
  onAspectClick,
  className,
}: RAGStagePanelProps) {
  const stageOrder = isProcurementStage(currentStage) ? PROCUREMENT_STAGE_ORDER : MANUFACTURING_STAGE_ORDER;
  const currentIndex = stageOrder.indexOf(currentStage);
  const stagesToRender = isProcurementStage(currentStage) ? stageOrder : stageOrder.slice(1);
  
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Stage Requirements</h3>
        <span className="text-xs text-gray-500">
          Complete each stage's requirements to advance
        </span>
      </div>
      
      {stagesToRender.map((stage, index) => {
        const stageIndex = isProcurementStage(currentStage) ? index : index + 1; // +1 because we sliced off concept
        const isCurrentStage = stage === currentStage;
        const isNextStage = stageIndex === currentIndex + 1;
        const isPastStage = stageIndex < currentIndex + 1;
        
        return (
          <StageRequirements
            key={stage}
            stage={stage}
            ragStatus={ragStatus}
            isCurrentStage={isCurrentStage}
            isNextStage={isNextStage}
            isPastStage={isPastStage}
            editable={editable}
            onAspectClick={onAspectClick}
          />
        );
      })}
    </div>
  );
}

export default RAGStagePanel;
