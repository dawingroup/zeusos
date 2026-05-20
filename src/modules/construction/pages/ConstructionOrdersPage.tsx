/**
 * Construction Orders List / Dashboard.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HardHat, Filter } from 'lucide-react';
import { useConstructionOrders } from '../hooks/useConstructionOrders';
import { RagBadge } from '@/shared/components/data-display';
import {
  CO_STAGES,
  CO_STAGE_LABELS,
  CO_STATUS_LABELS,
  type ConstructionOrderStatus,
  type COStage,
} from '../types';

export default function ConstructionOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<ConstructionOrderStatus | 'all'>('all');
  const [stageFilter, setStageFilter] = useState<COStage | 'all'>('all');

  const { orders, loading } = useConstructionOrders();

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (stageFilter !== 'all' && o.currentStage !== stageFilter) return false;
      return true;
    });
  }, [orders, statusFilter, stageFilter]);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md grid place-items-center"
            style={{ backgroundColor: 'var(--rag-amber-soft)' }}
          >
            <HardHat className="w-4 h-4" style={{ color: 'var(--rag-amber)' }} />
          </div>
          <div>
            <h1>Construction Orders</h1>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
              On-site execution for approved construction items.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-3.5 h-3.5" style={{ color: 'var(--fg-tertiary)' }} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConstructionOrderStatus | 'all')}
          className="px-2.5 py-1.5 text-[13px] border rounded-md"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--fg-primary)',
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(CO_STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as COStage | 'all')}
          className="px-2.5 py-1.5 text-[13px] border rounded-md"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--fg-primary)',
          }}
        >
          <option value="all">All stages</option>
          {CO_STAGES.map((s) => (
            <option key={s} value={s}>{CO_STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-[13px]" style={{ color: 'var(--fg-tertiary)' }}>
          Loading construction orders…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="text-center py-12 rounded-[10px] border border-dashed"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <HardHat className="w-9 h-9 mx-auto mb-3 opacity-40" style={{ color: 'var(--fg-tertiary)' }} />
          <p className="text-[14px]" style={{ color: 'var(--fg-primary)' }}>
            No construction orders yet.
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--fg-tertiary)' }}>
            A Construction Order is auto-created when a construction design item reaches the
            <span className="font-medium"> Approval</span> stage.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr
                className="border-b"
                style={{
                  backgroundColor: 'var(--bg-sunken)',
                  borderColor: 'var(--border-default)',
                }}
              >
                {(
                  [
                    ['CO #', 'left'],
                    ['Item', 'left'],
                    ['Contractor', 'left'],
                    ['Stage', 'left'],
                    ['Status', 'left'],
                    ['Total', 'right'],
                  ] as const
                ).map(([label, align]) => (
                  <th
                    key={label}
                    className={`px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wider ${
                      align === 'right' ? 'text-right' : 'text-left'
                    }`}
                    style={{ color: 'var(--fg-tertiary)' }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((co) => (
                <tr
                  key={co.id}
                  className="border-b last:border-b-0 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`/construction/${co.id}`}
                      className="font-mono font-medium hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {co.coNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2" style={{ color: 'var(--fg-primary)' }}>
                    {co.designItemName || '—'}
                  </td>
                  <td className="px-4 py-2" style={{ color: 'var(--fg-secondary)' }}>
                    {co.contractorName || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <RagBadge tone="amber">{CO_STAGE_LABELS[co.currentStage]}</RagBadge>
                  </td>
                  <td className="px-4 py-2">
                    <RagBadge tone="na">{CO_STATUS_LABELS[co.status]}</RagBadge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--fg-primary)' }}>
                    {co.currency} {(co.totalCost || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
