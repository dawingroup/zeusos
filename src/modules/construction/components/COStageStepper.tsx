/**
 * CO Stage Stepper — visual stepper for mobilisation → execution → qc → handover.
 */

import { CheckCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { CO_STAGES, CO_STAGE_LABELS, type COStage } from '../types';

export function COStageStepper({ currentStage }: { currentStage: COStage }) {
  const currentIndex = CO_STAGES.indexOf(currentStage);
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {CO_STAGES.map((stage, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={stage} className="flex items-center flex-1 min-w-[110px]">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium flex-shrink-0',
                isComplete && 'bg-green-500 text-white',
                isCurrent && 'bg-amber-600 text-white',
                !isComplete && !isCurrent && 'bg-gray-200 text-gray-500',
              )}
            >
              {isComplete ? <CheckCircle className="w-4 h-4" /> : index + 1}
            </div>
            <div className="ml-2 flex-1 min-w-0">
              <p
                className={cn(
                  'text-xs font-medium truncate',
                  isCurrent ? 'text-amber-600' : 'text-gray-500',
                )}
              >
                {CO_STAGE_LABELS[stage]}
              </p>
            </div>
            {index < CO_STAGES.length - 1 && (
              <div
                className={cn(
                  'w-6 h-0.5 mx-1 flex-shrink-0',
                  isComplete ? 'bg-green-500' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default COStageStepper;
