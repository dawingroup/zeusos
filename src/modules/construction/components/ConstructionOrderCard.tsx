/**
 * Construction Order Card — compact summary with a link to the CO detail page.
 */

import { Link } from 'react-router-dom';
import { HardHat, ArrowRight } from 'lucide-react';
import type { ConstructionOrder } from '../types';
import { CO_STAGE_LABELS, CO_STATUS_LABELS } from '../types';

export function ConstructionOrderCard({ co }: { co: ConstructionOrder }) {
  return (
    <Link
      to={`/construction/${co.id}`}
      className="block border border-amber-200 bg-amber-50/40 rounded-lg p-4 hover:bg-amber-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <HardHat className="w-5 h-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 truncate">
              {co.coNumber}
            </p>
            <p className="text-xs text-amber-700 truncate">
              {co.contractorName || 'Contractor TBD'}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded">
                {CO_STAGE_LABELS[co.currentStage]}
              </span>
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-white border border-amber-200 text-amber-700 rounded">
                {CO_STATUS_LABELS[co.status]}
              </span>
            </div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-3" />
      </div>
      <div className="mt-3 text-xs text-amber-700">
        {co.currency} {(co.totalCost || 0).toLocaleString()}
      </div>
    </Link>
  );
}

export default ConstructionOrderCard;
