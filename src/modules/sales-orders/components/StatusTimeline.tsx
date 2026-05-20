/**
 * StatusTimeline — Chronological events for a sales order lifecycle.
 */

import type { StatusChange } from '../types';
import { SO_STATUS_LABELS, SO_STATUS_COLORS } from '../constants';

interface StatusTimelineProps {
  statusHistory: StatusChange[];
}

function formatDate(ts: { toDate?: () => Date; seconds?: number }): string {
  const date = ts.toDate ? ts.toDate() : new Date((ts.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StatusTimeline({ statusHistory }: StatusTimelineProps) {
  if (statusHistory.length === 0) return null;

  return (
    <div>
      {statusHistory.map((change, idx) => {
        const colors = SO_STATUS_COLORS[change.toStatus];
        return (
          <div key={idx} className="flex gap-4 relative">
            {/* Timestamp */}
            <div className="flex-none w-[120px] py-2">
              <span className="text-xs text-gray-500">
                {formatDate(change.changedAt)}
              </span>
            </div>

            {/* Dot and connector */}
            <div className="flex flex-col items-center relative">
              <div
                className="w-3 h-3 rounded-full mt-3 z-10 border-2"
                style={{ backgroundColor: colors.bg, borderColor: colors.text }}
              />
              {idx < statusHistory.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className="py-2 pb-4">
              <p className="text-sm font-semibold text-gray-900">
                {SO_STATUS_LABELS[change.toStatus]}
              </p>
              {change.notes && (
                <p className="text-xs text-gray-500">{change.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
