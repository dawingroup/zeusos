/**
 * CoInvestmentSourceSelector
 *
 * Lets users tag a payment with a co-investment source from the program's
 * co-investment entries (filtered to the payment's project).
 * Only renders when matching entries exist.
 */

import { useMemo } from 'react';
import { useCoInvestments } from '../../hooks/co-investment-hooks';
import { CO_INVESTMENT_SOURCE_CONFIG } from '../../types/program-budget';
import type { CoInvestmentEntry } from '../../types/program-budget';
import { db } from '@/core/services/firebase';

interface CoInvestmentSourceSelectorProps {
  programId: string;
  projectId: string;
  currentEntryId?: string | null;
  onSelect: (entryId: string | null, sourceName: string | null) => void;
  disabled?: boolean;
}

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function CoInvestmentSourceSelector({
  programId,
  projectId,
  currentEntryId,
  onSelect,
  disabled,
}: CoInvestmentSourceSelectorProps) {
  const { entries, loading } = useCoInvestments(db, programId);

  // Filter entries to the current project
  const projectEntries = useMemo(
    () => entries.filter(e => e.projectId === projectId),
    [entries, projectId]
  );

  if (loading || projectEntries.length === 0) {
    return null;
  }

  const handleChange = (entryId: string) => {
    if (entryId === '') {
      onSelect(null, null);
    } else {
      const entry = projectEntries.find(e => e.id === entryId);
      onSelect(entryId, entry ? `${entry.sourceName} (${CO_INVESTMENT_SOURCE_CONFIG[entry.sourceType].label})` : null);
    }
  };

  return (
    <div className="bg-white border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-900 text-sm">Co-Investment Source</h3>
      </div>
      <div className="p-4">
        <select
          value={currentEntryId || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
        >
          <option value="">No co-investment</option>
          {projectEntries.map(entry => (
            <option key={entry.id} value={entry.id}>
              {entry.sourceName} ({CO_INVESTMENT_SOURCE_CONFIG[entry.sourceType].label}) — {fmtUSD.format(entry.pledged.amount)}
            </option>
          ))}
        </select>

        {/* Show selected entry details */}
        {currentEntryId && (
          <SelectedEntryDetail
            entry={projectEntries.find(e => e.id === currentEntryId)}
          />
        )}
      </div>
    </div>
  );
}

function SelectedEntryDetail({ entry }: { entry?: CoInvestmentEntry }) {
  if (!entry) return null;

  const cfg = CO_INVESTMENT_SOURCE_CONFIG[entry.sourceType];
  const disbursementPct = entry.pledged.amount > 0
    ? (entry.disbursed.amount / entry.pledged.amount) * 100
    : 0;

  return (
    <div className="mt-3 bg-gray-50 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-100">
          <tr>
            <td className="px-3 py-2 text-gray-500">Source</td>
            <td className="px-3 py-2 text-right">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color} ${cfg.bgColor}`}>
                {cfg.label}
              </span>
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-gray-500">Pledged</td>
            <td className="px-3 py-2 text-right font-medium text-gray-900 font-mono">
              {fmtUSD.format(entry.pledged.amount)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-gray-500">Disbursed</td>
            <td className="px-3 py-2 text-right font-medium text-emerald-600 font-mono">
              {fmtUSD.format(entry.disbursed.amount)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-gray-500">Disbursement</td>
            <td className="px-3 py-2 text-right font-medium text-gray-900">
              {disbursementPct.toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
