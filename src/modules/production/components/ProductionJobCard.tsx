/**
 * ProductionJobCard — compact card used in the kanban board.
 */

import { Link } from 'react-router-dom';
import type { ProductionJob } from '../types/production-job.types';
import { ProductionStageBadge } from './ProductionStageBadge';

interface Props {
  job: ProductionJob;
}

const TYPE_ICON: Record<string, string> = {
  TVC:         '🎬',
  RADIO:       '🎙',
  PHOTOGRAPHY: '📷',
  PRINT:       '🖨',
  EXHIBITION:  '🏛',
  OTHER:       '📋',
};

export function ProductionJobCard({ job }: Props) {
  return (
    <Link
      to={`/production/${job.id}`}
      className="block rounded border bg-background p-3 shadow-sm hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{job.title}</span>
        <span className="text-lg" aria-label={job.type}>
          {TYPE_ICON[job.type] ?? '📋'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <ProductionStageBadge stage={job.stage} />
      </div>
      {job.scheduledShootDate && (
        <p className="text-xs text-muted-foreground">
          Shoot: {job.scheduledShootDate}
        </p>
      )}
    </Link>
  );
}
