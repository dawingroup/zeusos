/**
 * ProductionKanban — flexbox kanban with one column per production stage.
 *
 * Each column shows the jobs in that stage. Clicking a card navigates to
 * the job detail page. Stage advancement is done from the detail page.
 */

import type { ProductionJob, ProductionStage } from '../types/production-job.types';
import { PRODUCTION_STAGES } from '../types/production-job.types';
import { ProductionJobCard } from './ProductionJobCard';

const STAGE_LABEL: Record<ProductionStage, string> = {
  BRIEF:            'Brief',
  PRE_PRODUCTION:   'Pre-Prod',
  TALENT_BOOKING:   'Talent',
  LOCATION_LOCK:    'Location',
  EQUIPMENT:        'Equipment',
  SHOOT:            'Shoot',
  POST_PRODUCTION:  'Post',
  CLIENT_REVIEW:    'Client Review',
  MASTER_DELIVERY:  'Delivery',
  COMPLETE:         'Complete',
};

interface Props {
  jobs: ProductionJob[];
}

export function ProductionKanban({ jobs }: Props) {
  const grouped: Record<ProductionStage, ProductionJob[]> = {} as Record<ProductionStage, ProductionJob[]>;
  for (const stage of PRODUCTION_STAGES) {
    grouped[stage] = [];
  }
  for (const job of jobs) {
    if (grouped[job.stage]) {
      grouped[job.stage].push(job);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PRODUCTION_STAGES.map((stage) => {
        const stageJobs = grouped[stage];
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-48 rounded border bg-muted/20"
          >
            <div className="border-b px-2 py-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {STAGE_LABEL[stage]}
              </p>
              <p className="text-xs text-muted-foreground">{stageJobs.length}</p>
            </div>
            <div className="space-y-2 p-2">
              {stageJobs.map((job) => (
                <ProductionJobCard key={job.id} job={job} />
              ))}
              {stageJobs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No jobs
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
