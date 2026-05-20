/**
 * RAG Status Panel Component
 * Panel showing all 19 RAG aspects organized by category
 */

import { cn } from '@/shared/lib/utils';
import type { RAGStatus, RAGValue } from '../../types';
import { RAGIndicator } from './RAGIndicator';
import { getCategoryReadiness } from '../../utils/rag-calculations';

export interface RAGStatusPanelProps {
  ragStatus: RAGStatus;
  editable?: boolean;
  onAspectClick?: (category: keyof RAGStatus, aspect: string, value: RAGValue) => void;
  className?: string;
}

interface AspectConfig {
  key: string;
  label: string;
}

const DESIGN_COMPLETENESS_ASPECTS: AspectConfig[] = [
  { key: 'overallDimensions', label: 'Overall Dimensions' },
  { key: 'model3D', label: '3D Model' },
  { key: 'productionDrawings', label: 'Production Drawings' },
  { key: 'materialSpecs', label: 'Material Specs' },
  { key: 'hardwareSpecs', label: 'Hardware Specs' },
  { key: 'finishSpecs', label: 'Finish Specs' },
  { key: 'joineryDetails', label: 'Joinery Details' },
  { key: 'tolerances', label: 'Tolerances' },
  { key: 'assemblyInstructions', label: 'Assembly Instructions' },
];

const MANUFACTURING_READINESS_ASPECTS: AspectConfig[] = [
  { key: 'materialAvailability', label: 'Material Availability' },
  { key: 'hardwareAvailability', label: 'Hardware Availability' },
  { key: 'toolingReadiness', label: 'Tooling Readiness' },
  { key: 'processDocumentation', label: 'Process Documentation' },
  { key: 'qualityCriteria', label: 'Quality Criteria' },
  { key: 'costValidation', label: 'Cost Validation' },
];

const QUALITY_GATES_ASPECTS: AspectConfig[] = [
  { key: 'internalDesignReview', label: 'Internal Design Review' },
  { key: 'manufacturingReview', label: 'Manufacturing Review' },
  { key: 'clientApproval', label: 'Client Approval' },
  { key: 'prototypeValidation', label: 'Prototype Validation' },
];

interface CategorySectionProps {
  title: string;
  readiness: number;
  aspects: AspectConfig[];
  values: Record<string, RAGValue>;
  category: keyof RAGStatus;
  editable?: boolean;
  onAspectClick?: (category: keyof RAGStatus, aspect: string, value: RAGValue) => void;
}

function CategorySection({ 
  title, 
  readiness, 
  aspects, 
  values, 
  category,
  editable,
  onAspectClick 
}: CategorySectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          readiness >= 80 ? 'bg-green-100 text-green-700' :
          readiness >= 50 ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        )}>
          {readiness}%
        </span>
      </div>
      <div className="space-y-1">
        {aspects.map(({ key, label }) => {
          const value = values[key];
          if (!value) return null;
          
          return (
            <div 
              key={key}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 rounded-md',
                editable && 'hover:bg-gray-50 cursor-pointer',
                !editable && 'cursor-default'
              )}
              onClick={() => editable && onAspectClick?.(category, key, value)}
            >
              <RAGIndicator 
                status={value.status} 
                size="sm"
              />
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              {value.notes && (
                <span className="text-xs text-gray-400 truncate max-w-[100px]">
                  {value.notes}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RAGStatusPanel({ 
  ragStatus, 
  editable = false, 
  onAspectClick,
  className 
}: RAGStatusPanelProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <CategorySection
        title="Design Completeness"
        readiness={getCategoryReadiness(ragStatus, 'designCompleteness')}
        aspects={DESIGN_COMPLETENESS_ASPECTS}
        values={(ragStatus?.designCompleteness || {}) as unknown as Record<string, RAGValue>}
        category="designCompleteness"
        editable={editable}
        onAspectClick={onAspectClick}
      />
      
      <CategorySection
        title="Manufacturing Readiness"
        readiness={getCategoryReadiness(ragStatus, 'manufacturingReadiness')}
        aspects={MANUFACTURING_READINESS_ASPECTS}
        values={(ragStatus?.manufacturingReadiness || {}) as unknown as Record<string, RAGValue>}
        category="manufacturingReadiness"
        editable={editable}
        onAspectClick={onAspectClick}
      />
      
      <CategorySection
        title="Quality Gates"
        readiness={getCategoryReadiness(ragStatus, 'qualityGates')}
        aspects={QUALITY_GATES_ASPECTS}
        values={(ragStatus?.qualityGates || {}) as unknown as Record<string, RAGValue>}
        category="qualityGates"
        editable={editable}
        onAspectClick={onAspectClick}
      />
    </div>
  );
}

export default RAGStatusPanel;
