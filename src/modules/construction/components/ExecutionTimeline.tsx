/**
 * Execution Timeline — renders the canonical on-site signals for a CO:
 * site handover → kickoff → inspection → signoff → completion.
 */

import { Check, Circle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ConstructionExecutionTracking } from '../types';

type Step = {
  key: keyof ConstructionExecutionTracking;
  label: string;
  byKey?: keyof ConstructionExecutionTracking;
};

const STEPS: Step[] = [
  { key: 'siteHandoverAt', label: 'Site Handover', byKey: 'siteHandoverBy' },
  { key: 'kickoffAt', label: 'Kickoff', byKey: 'kickoffBy' },
  { key: 'inspectionPassedAt', label: 'Inspection Passed', byKey: 'inspectedBy' },
  { key: 'signoffAt', label: 'Final Signoff', byKey: 'signedOffBy' },
  { key: 'completedAt', label: 'Completed', byKey: 'completedBy' },
];

function formatTs(ts: unknown): string {
  if (!ts) return '—';
  // Firestore Timestamp has toDate()
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    try {
      return (ts as { toDate: () => Date }).toDate().toLocaleString();
    } catch {
      return '—';
    }
  }
  return '—';
}

export function ExecutionTimeline({
  execution,
}: {
  execution?: ConstructionExecutionTracking;
}) {
  const e = execution || {};
  return (
    <div className="space-y-3">
      {STEPS.map((step) => {
        const ts = e[step.key];
        const by = step.byKey ? (e[step.byKey] as string | undefined) : undefined;
        const done = !!ts;
        return (
          <div key={String(step.key)} className="flex items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0',
                done ? 'bg-green-100' : 'bg-gray-100',
              )}
            >
              {done ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium', done ? 'text-gray-900' : 'text-gray-400')}>
                {step.label}
              </p>
              <p className="text-xs text-gray-500">
                {formatTs(ts)}
                {by ? ` · ${by}` : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ExecutionTimeline;
