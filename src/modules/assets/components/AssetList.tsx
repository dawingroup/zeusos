/**
 * Asset List Component
 * Table view of assets with status badges
 */

import { ChevronRight } from 'lucide-react';
import type { Asset, AssetStatus } from '@/shared/types';

interface AssetListProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
  onStatusChange: (asset: Asset, newStatus: AssetStatus) => void;
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<AssetStatus, { label: string; bg: string; text: string; dot: string }> = {
  ACTIVE: { label: 'Active', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  MAINTENANCE: { label: 'Maintenance', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  BROKEN: { label: 'Broken', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  CHECKED_OUT: { label: 'Checked Out', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  RETIRED: { label: 'Retired', bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' },
};

const CATEGORY_ICONS: Record<string, string> = {
  STATIONARY_MACHINE: '🏭',
  POWER_TOOL: '🔌',
  HAND_TOOL: '🔧',
  JIG: '📐',
};

export function AssetList({ assets, onAssetClick, onStatusChange, isLoading }: AssetListProps) {
  if (isLoading) {
    return (
      <div
        className="overflow-hidden rounded-[10px] border shadow-[var(--shadow-sm)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-1/6" />
              <div className="h-4 bg-gray-200 rounded w-1/5 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No assets</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by adding your first asset.</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <table className="min-w-full border-collapse">
        <thead>
          <tr
            className="border-b"
            style={{
              backgroundColor: 'var(--bg-sunken)',
              borderColor: 'var(--border-default)',
            }}
          >
            <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider min-w-[220px]" style={{ color: 'var(--fg-tertiary)' }}>Asset</th>
            <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Status</th>
            <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Location</th>
            <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Specs</th>
            <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Maintenance</th>
            <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Status Action</th>
            <th className="px-3 py-2.5 text-right w-10"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const statusConfig = STATUS_CONFIG[asset.status];
            const displayName = asset.nickname || `${asset.brand} ${asset.model}`;
            const maintenanceDue = asset.maintenance?.nextServiceDue
              ? new Date(asset.maintenance.nextServiceDue) <= new Date()
              : false;

            return (
              <tr
                key={asset.id}
                onClick={() => onAssetClick(asset)}
                className="border-b transition-colors cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{CATEGORY_ICONS[asset.category] || '🔧'}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate max-w-[200px]" style={{ color: 'var(--fg-primary)' }}>
                        {displayName}
                      </div>
                      {asset.nickname && (
                        <div className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--fg-tertiary)' }}>
                          {asset.brand} {asset.model}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} mr-1.5`} />
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>
                  {asset.location?.zone || '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {Object.entries(asset.specs || {}).slice(0, 2).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-[11px] text-gray-700"
                      >
                        <span className="font-medium">{key}:</span>
                        <span className="ml-1 truncate max-w-[80px]">{String(value)}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {maintenanceDue ? (
                    <span className="inline-flex items-center text-[12px] text-amber-600 bg-amber-50 rounded px-2 py-0.5">
                      Due
                    </span>
                  ) : (
                    <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>OK</span>
                  )}
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={asset.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      onStatusChange(asset, e.target.value as AssetStatus);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[12px] border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--fg-quaternary)' }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div
        className="px-4 py-2.5 border-t text-[11.5px]"
        style={{
          backgroundColor: 'var(--bg-sunken)',
          borderColor: 'var(--border-default)',
          color: 'var(--fg-tertiary)',
        }}
      >
        {assets.length} asset{assets.length !== 1 ? 's' : ''} shown
      </div>
    </div>
  );
}
