/**
 * Checkout History
 * Table showing asset checkout/checkin records.
 */

import { UserCheck } from 'lucide-react';
import type { AssetCheckout } from '../types';

function formatDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') return new Date(value).toLocaleString();
  return 'Unknown';
}

function toMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
}

interface CheckoutHistoryProps {
  checkouts: AssetCheckout[];
}

export function CheckoutHistory({ checkouts }: CheckoutHistoryProps) {
  if (checkouts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No checkout records</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Checked Out By
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Checked Out
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Checked In
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Duration
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {checkouts.map((checkout) => {
            const isActive = !checkout.checkedInAt;
            const outMs = toMs(checkout.checkedOutAt);
            const inMs = checkout.checkedInAt
              ? toMs(checkout.checkedInAt)
              : Date.now();

            return (
              <tr
                key={checkout.id}
                className={`border-b border-gray-50 ${isActive ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}
              >
                <td className="py-2.5 px-3 text-gray-700">
                  {checkout.checkedOutBy}
                  {isActive && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-gray-500">
                  {formatDate(checkout.checkedOutAt)}
                </td>
                <td className="py-2.5 px-3 text-xs text-gray-500">
                  {checkout.checkedInAt ? (
                    formatDate(checkout.checkedInAt)
                  ) : (
                    <span className="text-blue-600 font-medium">
                      Still out
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-gray-600 font-medium">
                  {formatDuration(outMs, inMs)}
                </td>
                <td className="py-2.5 px-3 text-gray-500">
                  {checkout.notes || (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
