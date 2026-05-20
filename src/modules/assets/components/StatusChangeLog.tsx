/**
 * Status Change Log
 * Audit log table showing asset status transitions.
 */

import { History } from 'lucide-react';
import type { AssetStatusChange, AssetStatus } from '@/shared/types';

const STATUS_COLORS: Record<AssetStatus, { bg: string; text: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700' },
  MAINTENANCE: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  BROKEN: { bg: 'bg-red-100', text: 'text-red-700' },
  CHECKED_OUT: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RETIRED: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: 'Active',
  MAINTENANCE: 'Maintenance',
  BROKEN: 'Broken',
  CHECKED_OUT: 'Checked Out',
  RETIRED: 'Retired',
};

function StatusBadge({ status }: { status: AssetStatus }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.ACTIVE;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function formatDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') return new Date(value).toLocaleString();
  return 'Unknown';
}

interface StatusChangeLogProps {
  changes: AssetStatusChange[];
}

export function StatusChangeLog({ changes }: StatusChangeLogProps) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No status changes recorded</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Date
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              From
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              To
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Reason
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Changed By
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr
              key={change.id}
              className="border-b border-gray-50 hover:bg-gray-50/50"
            >
              <td className="py-2.5 px-3 text-xs text-gray-500">
                {formatDate(change.changedAt)}
              </td>
              <td className="py-2.5 px-3">
                <StatusBadge status={change.fromStatus} />
              </td>
              <td className="py-2.5 px-3">
                <StatusBadge status={change.toStatus} />
              </td>
              <td className="py-2.5 px-3 text-gray-700">
                {change.reason || (
                  <span className="text-gray-400 italic">No reason</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-gray-500">{change.changedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
